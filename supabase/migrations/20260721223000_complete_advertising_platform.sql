BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.gsa_advertisers
  ADD COLUMN IF NOT EXISTS invited_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_access_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS gsa_advertisers_auth_user_unique
  ON public.gsa_advertisers(auth_user_id)
  WHERE auth_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.gsa_ad_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL UNIQUE REFERENCES public.gsa_ad_campaigns(id) ON DELETE CASCADE,
  proposal_id uuid REFERENCES public.gsa_ad_proposals(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'manual',
  provider_reference text UNIQUE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'BRL' CHECK (currency = 'BRL'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','paid','failed','refunded','cancelled')),
  payment_method text,
  checkout_url text,
  pix_code text,
  due_at timestamptz,
  paid_at timestamptz,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gsa_ad_payment_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  payment_id uuid NOT NULL REFERENCES public.gsa_ad_payments(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  status text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_event_id)
);

CREATE TABLE IF NOT EXISTS public.gsa_ad_delivery_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.gsa_ad_campaigns(id) ON DELETE CASCADE,
  placement_id uuid NOT NULL REFERENCES public.gsa_ad_placements(id) ON DELETE CASCADE,
  creative_id uuid NOT NULL REFERENCES public.gsa_ad_creatives(id) ON DELETE CASCADE,
  viewer_hash text NOT NULL,
  session_hash text NOT NULL,
  route text,
  device text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  served_at timestamptz NOT NULL DEFAULT now(),
  viewable_at timestamptz,
  clicked_at timestamptz,
  video_started_at timestamptz,
  video_completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS gsa_ad_delivery_frequency_idx
  ON public.gsa_ad_delivery_events(campaign_id, viewer_hash, served_at DESC);
CREATE INDEX IF NOT EXISTS gsa_ad_delivery_session_idx
  ON public.gsa_ad_delivery_events(campaign_id, session_hash, served_at DESC);
CREATE INDEX IF NOT EXISTS gsa_ad_metrics_date_idx
  ON public.gsa_ad_daily_metrics(metric_date DESC, campaign_id);

DROP TRIGGER IF EXISTS trg_gsa_ad_payments_updated_at ON public.gsa_ad_payments;
CREATE TRIGGER trg_gsa_ad_payments_updated_at
BEFORE UPDATE ON public.gsa_ad_payments
FOR EACH ROW EXECUTE FUNCTION public.gsa_ads_touch_updated_at();

CREATE OR REPLACE FUNCTION public.gsa_current_advertiser_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT id
    FROM public.gsa_advertisers
   WHERE auth_user_id = auth.uid()
     AND status = 'active'
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.gsa_ads_refresh_campaign_states()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_completed integer := 0;
  v_active integer := 0;
  v_scheduled integer := 0;
  v_review integer := 0;
BEGIN
  UPDATE public.gsa_ad_campaigns
     SET status = 'completed'
   WHERE status NOT IN ('completed','cancelled')
     AND ends_at IS NOT NULL
     AND ends_at <= now();
  GET DIAGNOSTICS v_completed = ROW_COUNT;

  UPDATE public.gsa_ad_campaigns c
     SET status = 'active',
         activated_at = COALESCE(activated_at, now())
   WHERE c.status NOT IN ('active','paused','completed','cancelled')
     AND c.paid_at IS NOT NULL
     AND COALESCE(c.starts_at, now()) <= now()
     AND (c.ends_at IS NULL OR c.ends_at > now())
     AND EXISTS (
       SELECT 1 FROM public.gsa_ad_creatives cr
        WHERE cr.campaign_id = c.id AND cr.status = 'approved'
     );
  GET DIAGNOSTICS v_active = ROW_COUNT;

  UPDATE public.gsa_ad_campaigns c
     SET status = 'scheduled'
   WHERE c.status NOT IN ('paused','completed','cancelled')
     AND c.paid_at IS NOT NULL
     AND c.starts_at > now()
     AND EXISTS (
       SELECT 1 FROM public.gsa_ad_creatives cr
        WHERE cr.campaign_id = c.id AND cr.status = 'approved'
     );
  GET DIAGNOSTICS v_scheduled = ROW_COUNT;

  UPDATE public.gsa_ad_campaigns c
     SET status = 'creative_review'
   WHERE c.status NOT IN ('paused','completed','cancelled')
     AND c.paid_at IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.gsa_ad_creatives cr
        WHERE cr.campaign_id = c.id AND cr.status = 'approved'
     );
  GET DIAGNOSTICS v_review = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'completed', v_completed,
    'active', v_active,
    'scheduled', v_scheduled,
    'creative_review', v_review
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_create_ad_proposal(p_request_id uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request public.gsa_ad_requests;
  v_advertiser_id uuid;
  v_proposal_id uuid;
  v_version integer;
  v_amount numeric(12,2);
  v_starts date;
  v_ends date;
  v_duration integer;
  v_formats text[];
  v_placements text[];
BEGIN
  IF NOT public.gsa_admin_has_module('anuncios') THEN
    RAISE EXCEPTION 'Acesso negado ao módulo de anúncios' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_request FROM public.gsa_ad_requests WHERE id = p_request_id FOR UPDATE;
  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'Solicitação não encontrada' USING ERRCODE = 'P0002';
  END IF;

  v_amount := COALESCE((p_payload->>'amount')::numeric, 0);
  IF v_amount <= 0 THEN RAISE EXCEPTION 'Valor da proposta inválido' USING ERRCODE = '22023'; END IF;

  v_starts := COALESCE(nullif(p_payload->>'starts_on','')::date, v_request.desired_start_date, current_date + 7);
  v_ends := COALESCE(nullif(p_payload->>'ends_on','')::date, v_request.desired_end_date, v_starts + 29);
  IF v_ends < v_starts THEN RAISE EXCEPTION 'Período da proposta inválido' USING ERRCODE = '22023'; END IF;
  v_duration := (v_ends - v_starts) + 1;
  v_formats := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'formats', to_jsonb(v_request.desired_formats))));
  v_placements := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'placement_codes', to_jsonb(v_request.desired_pages))));

  SELECT id INTO v_advertiser_id
    FROM public.gsa_advertisers
   WHERE regexp_replace(document, '[^0-9]', '', 'g') = regexp_replace(v_request.document, '[^0-9]', '', 'g')
   LIMIT 1;

  IF v_advertiser_id IS NULL THEN
    INSERT INTO public.gsa_advertisers (
      legal_name, trade_name, document, company_size, segment, website,
      responsible_name, responsible_email, responsible_phone, status
    ) VALUES (
      v_request.company_name, v_request.company_name, v_request.document, v_request.company_size,
      v_request.segment, v_request.website, v_request.contact_name,
      lower(v_request.contact_email), v_request.contact_phone, 'pending_verification'
    ) RETURNING id INTO v_advertiser_id;
  ELSE
    UPDATE public.gsa_advertisers
       SET legal_name = v_request.company_name,
           trade_name = COALESCE(trade_name, v_request.company_name),
           company_size = v_request.company_size,
           segment = v_request.segment,
           website = COALESCE(v_request.website, website),
           responsible_name = v_request.contact_name,
           responsible_email = lower(v_request.contact_email),
           responsible_phone = v_request.contact_phone
     WHERE id = v_advertiser_id;
  END IF;

  UPDATE public.gsa_ad_requests SET advertiser_id = v_advertiser_id WHERE id = p_request_id;

  SELECT id, current_version INTO v_proposal_id, v_version
    FROM public.gsa_ad_proposals WHERE request_id = p_request_id FOR UPDATE;

  IF v_proposal_id IS NULL THEN
    v_version := 1;
    INSERT INTO public.gsa_ad_proposals (
      request_id, current_version, status, total_amount, valid_until, created_by
    ) VALUES (
      p_request_id, v_version, 'sent', v_amount,
      COALESCE(nullif(p_payload->>'valid_until','')::timestamptz, now() + interval '7 days'),
      public.gsa_current_actor_id()
    ) RETURNING id INTO v_proposal_id;
  ELSE
    v_version := v_version + 1;
    UPDATE public.gsa_ad_proposals
       SET current_version = v_version,
           status = 'sent',
           total_amount = v_amount,
           valid_until = COALESCE(nullif(p_payload->>'valid_until','')::timestamptz, now() + interval '7 days')
     WHERE id = v_proposal_id;
  END IF;

  INSERT INTO public.gsa_ad_proposal_versions (
    proposal_id, version, amount, duration_days, starts_on, ends_on,
    formats, placement_codes, frequency_model, frequency_value,
    impression_limit, terms, created_by_type, created_by
  ) VALUES (
    v_proposal_id, v_version, v_amount, v_duration, v_starts, v_ends,
    v_formats, v_placements,
    COALESCE(nullif(p_payload->>'frequency_model',''), 'once_per_day'),
    nullif(p_payload->>'frequency_value','')::integer,
    nullif(p_payload->>'impression_limit','')::bigint,
    nullif(trim(p_payload->>'terms'), ''),
    'admin', public.gsa_current_actor_id()
  );

  UPDATE public.gsa_ad_requests SET status = 'proposal_sent' WHERE id = p_request_id;
  INSERT INTO public.gsa_ad_audit_logs(actor_type, actor_id, action, entity_type, entity_id, details)
  VALUES (public.gsa_current_actor_type(), public.gsa_current_actor_id(), 'CREATE_PROPOSAL', 'ad_proposal', v_proposal_id,
    jsonb_build_object('version', v_version, 'amount', v_amount));

  RETURN jsonb_build_object(
    'success', true,
    'advertiser_id', v_advertiser_id,
    'proposal_id', v_proposal_id,
    'version', v_version,
    'amount', v_amount
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_get_advertiser_invite_target(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.gsa_admin_has_module('anuncios') THEN
    RAISE EXCEPTION 'Acesso negado ao módulo de anúncios' USING ERRCODE = '42501';
  END IF;
  SELECT jsonb_build_object(
    'advertiser_id', a.id,
    'email', a.responsible_email,
    'name', COALESCE(a.trade_name, a.legal_name),
    'auth_user_id', a.auth_user_id
  ) INTO v_result
  FROM public.gsa_ad_requests r
  JOIN public.gsa_advertisers a ON a.id = r.advertiser_id
  WHERE r.id = p_request_id;
  IF v_result IS NULL THEN RAISE EXCEPTION 'Crie a proposta antes de liberar o portal' USING ERRCODE = 'P0002'; END IF;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_link_advertiser_auth(p_advertiser_id uuid, p_auth_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.gsa_admin_has_module('anuncios') THEN
    RAISE EXCEPTION 'Acesso negado ao módulo de anúncios' USING ERRCODE = '42501';
  END IF;
  UPDATE public.gsa_advertisers
     SET auth_user_id = p_auth_user_id,
         status = 'active',
         invited_at = COALESCE(invited_at, now())
   WHERE id = p_advertiser_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Anunciante não encontrado' USING ERRCODE = 'P0002'; END IF;
  RETURN jsonb_build_object('success', true, 'advertiser_id', p_advertiser_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_advertiser_portal_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_advertiser_id uuid := public.gsa_current_advertiser_id();
  v_result jsonb;
BEGIN
  IF v_advertiser_id IS NULL THEN
    RAISE EXCEPTION 'Conta de anunciante não vinculada ou suspensa' USING ERRCODE = '42501';
  END IF;

  UPDATE public.gsa_advertisers SET last_access_at = now() WHERE id = v_advertiser_id;

  SELECT jsonb_build_object(
    'advertiser', jsonb_build_object(
      'id', a.id, 'legal_name', a.legal_name, 'trade_name', a.trade_name,
      'segment', a.segment, 'website', a.website, 'responsible_name', a.responsible_name,
      'responsible_email', a.responsible_email, 'responsible_phone', a.responsible_phone,
      'status', a.status
    ),
    'requests', COALESCE((
      SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC)
        FROM public.gsa_ad_requests r WHERE r.advertiser_id = a.id
    ), '[]'::jsonb),
    'proposals', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'request_id', p.request_id, 'status', p.status,
        'current_version', p.current_version, 'total_amount', p.total_amount,
        'valid_until', p.valid_until, 'accepted_at', p.accepted_at,
        'version', to_jsonb(v),
        'negotiations', COALESCE((SELECT jsonb_agg(to_jsonb(n) ORDER BY n.created_at) FROM public.gsa_ad_negotiations n WHERE n.proposal_id = p.id), '[]'::jsonb)
      ) ORDER BY p.created_at DESC)
      FROM public.gsa_ad_proposals p
      JOIN public.gsa_ad_requests r ON r.id = p.request_id AND r.advertiser_id = a.id
      LEFT JOIN public.gsa_ad_proposal_versions v ON v.proposal_id = p.id AND v.version = p.current_version
    ), '[]'::jsonb),
    'campaigns', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.name, 'slug', c.slug, 'status', c.status,
        'starts_at', c.starts_at, 'ends_at', c.ends_at, 'paid_at', c.paid_at,
        'frequency_model', c.frequency_model, 'frequency_value', c.frequency_value,
        'impression_limit', c.impression_limit,
        'creatives', COALESCE((SELECT jsonb_agg(to_jsonb(cr) ORDER BY cr.created_at DESC) FROM public.gsa_ad_creatives cr WHERE cr.campaign_id = c.id), '[]'::jsonb),
        'payment', (SELECT to_jsonb(pay) FROM public.gsa_ad_payments pay WHERE pay.campaign_id = c.id),
        'metrics', COALESCE((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.metric_date) FROM public.gsa_ad_daily_metrics m WHERE m.campaign_id = c.id), '[]'::jsonb)
      ) ORDER BY c.created_at DESC)
      FROM public.gsa_ad_campaigns c WHERE c.advertiser_id = a.id
    ), '[]'::jsonb)
  ) INTO v_result
  FROM public.gsa_advertisers a WHERE a.id = v_advertiser_id;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_advertiser_counter_proposal(p_proposal_id uuid, p_amount numeric, p_message text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_advertiser_id uuid := public.gsa_current_advertiser_id();
BEGIN
  IF v_advertiser_id IS NULL OR p_amount <= 0 OR length(trim(COALESCE(p_message,''))) < 3 THEN
    RAISE EXCEPTION 'Contraproposta inválida' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.gsa_ad_proposals p
    JOIN public.gsa_ad_requests r ON r.id = p.request_id
    WHERE p.id = p_proposal_id AND r.advertiser_id = v_advertiser_id AND p.status IN ('sent','negotiating','final_offer')
  ) THEN RAISE EXCEPTION 'Proposta não disponível' USING ERRCODE = '42501'; END IF;

  INSERT INTO public.gsa_ad_negotiations(proposal_id, actor_type, actor_id, proposed_amount, message)
  VALUES (p_proposal_id, 'advertiser', v_advertiser_id, p_amount, trim(p_message));
  UPDATE public.gsa_ad_proposals SET status = 'negotiating' WHERE id = p_proposal_id;
  UPDATE public.gsa_ad_requests SET status = 'negotiation_requested'
   WHERE id = (SELECT request_id FROM public.gsa_ad_proposals WHERE id = p_proposal_id);
  RETURN jsonb_build_object('success', true, 'status', 'negotiating');
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_advertiser_accept_proposal(p_proposal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_advertiser_id uuid := public.gsa_current_advertiser_id();
  v_proposal public.gsa_ad_proposals;
  v_version public.gsa_ad_proposal_versions;
  v_request public.gsa_ad_requests;
  v_campaign_id uuid;
  v_payment_id uuid;
  v_code text;
BEGIN
  SELECT p.* INTO v_proposal
    FROM public.gsa_ad_proposals p
    JOIN public.gsa_ad_requests r ON r.id = p.request_id
   WHERE p.id = p_proposal_id AND r.advertiser_id = v_advertiser_id
     AND p.status IN ('sent','negotiating','final_offer')
   FOR UPDATE;
  IF v_proposal.id IS NULL THEN RAISE EXCEPTION 'Proposta não disponível' USING ERRCODE = '42501'; END IF;
  IF v_proposal.valid_until IS NOT NULL AND v_proposal.valid_until < now() THEN
    UPDATE public.gsa_ad_proposals SET status = 'expired' WHERE id = p_proposal_id;
    RAISE EXCEPTION 'Proposta expirada' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_version FROM public.gsa_ad_proposal_versions
   WHERE proposal_id = p_proposal_id AND version = v_proposal.current_version;
  SELECT * INTO v_request FROM public.gsa_ad_requests WHERE id = v_proposal.request_id;

  INSERT INTO public.gsa_ad_campaigns (
    advertiser_id, proposal_id, name, slug, status, starts_at, ends_at,
    frequency_model, frequency_value, impression_limit
  ) VALUES (
    v_advertiser_id, p_proposal_id,
    v_request.company_name || ' — ' || to_char(v_version.starts_on, 'DD/MM/YYYY'),
    lower(trim(both '-' from regexp_replace(v_request.company_name, '[^a-zA-Z0-9]+', '-', 'g'))) || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,8),
    'payment_pending', v_version.starts_on::timestamptz, (v_version.ends_on + 1)::timestamptz,
    v_version.frequency_model, v_version.frequency_value, v_version.impression_limit
  )
  ON CONFLICT (proposal_id) DO UPDATE SET
    starts_at = EXCLUDED.starts_at, ends_at = EXCLUDED.ends_at,
    frequency_model = EXCLUDED.frequency_model, frequency_value = EXCLUDED.frequency_value,
    impression_limit = EXCLUDED.impression_limit
  RETURNING id INTO v_campaign_id;

  FOREACH v_code IN ARRAY v_version.placement_codes LOOP
    INSERT INTO public.gsa_ad_campaign_placements(campaign_id, placement_id)
    SELECT v_campaign_id, id FROM public.gsa_ad_placements WHERE code = v_code AND active
    ON CONFLICT DO NOTHING;
  END LOOP;

  INSERT INTO public.gsa_ad_payments(campaign_id, proposal_id, amount, status, due_at)
  VALUES (v_campaign_id, p_proposal_id, v_version.amount, 'pending', now() + interval '3 days')
  ON CONFLICT (campaign_id) DO UPDATE SET amount = EXCLUDED.amount, proposal_id = EXCLUDED.proposal_id
  RETURNING id INTO v_payment_id;

  UPDATE public.gsa_ad_proposals SET status = 'accepted', accepted_at = now() WHERE id = p_proposal_id;
  UPDATE public.gsa_ad_requests SET status = 'accepted' WHERE id = v_proposal.request_id;

  RETURN jsonb_build_object('success', true, 'campaign_id', v_campaign_id, 'payment_id', v_payment_id, 'status', 'payment_pending');
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_advertiser_save_creative(
  p_creative_id uuid,
  p_campaign_id uuid,
  p_kind text,
  p_storage_path text,
  p_target_url text,
  p_headline text,
  p_body text,
  p_alt_text text,
  p_width integer,
  p_height integer,
  p_duration_seconds numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_advertiser_id uuid := public.gsa_current_advertiser_id();
  v_id uuid;
BEGIN
  IF p_kind NOT IN ('image','video','text') THEN RAISE EXCEPTION 'Tipo de criativo inválido' USING ERRCODE = '22023'; END IF;
  IF p_target_url IS NOT NULL AND p_target_url !~ '^https://' THEN RAISE EXCEPTION 'URL de destino inválida' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.gsa_ad_campaigns WHERE id = p_campaign_id AND advertiser_id = v_advertiser_id) THEN
    RAISE EXCEPTION 'Campanha não autorizada' USING ERRCODE = '42501';
  END IF;
  IF p_storage_path IS NOT NULL AND split_part(p_storage_path, '/', 1) <> v_advertiser_id::text THEN
    RAISE EXCEPTION 'Caminho de arquivo inválido' USING ERRCODE = '42501';
  END IF;

  IF p_creative_id IS NULL THEN
    INSERT INTO public.gsa_ad_creatives(
      campaign_id, kind, status, storage_path, target_url, headline, body, alt_text,
      width, height, duration_seconds
    ) VALUES (
      p_campaign_id, p_kind, 'draft', nullif(p_storage_path,''), nullif(p_target_url,''),
      nullif(trim(p_headline),''), nullif(trim(p_body),''), nullif(trim(p_alt_text),''),
      p_width, p_height, p_duration_seconds
    ) RETURNING id INTO v_id;
  ELSE
    UPDATE public.gsa_ad_creatives
       SET kind = p_kind, storage_path = nullif(p_storage_path,''), target_url = nullif(p_target_url,''),
           headline = nullif(trim(p_headline),''), body = nullif(trim(p_body),''),
           alt_text = nullif(trim(p_alt_text),''), width = p_width, height = p_height,
           duration_seconds = p_duration_seconds, status = 'draft', rejection_reason = NULL
     WHERE id = p_creative_id AND campaign_id = p_campaign_id AND status IN ('draft','rejected')
     RETURNING id INTO v_id;
  END IF;
  IF v_id IS NULL THEN RAISE EXCEPTION 'Criativo não editável' USING ERRCODE = '42501'; END IF;
  RETURN jsonb_build_object('success', true, 'creative_id', v_id, 'status', 'draft');
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_advertiser_submit_creative(p_creative_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_advertiser_id uuid := public.gsa_current_advertiser_id();
BEGIN
  UPDATE public.gsa_ad_creatives cr
     SET status = 'pending_review', rejection_reason = NULL
   WHERE cr.id = p_creative_id
     AND cr.status IN ('draft','rejected')
     AND EXISTS (SELECT 1 FROM public.gsa_ad_campaigns c WHERE c.id = cr.campaign_id AND c.advertiser_id = v_advertiser_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'Criativo não disponível para envio' USING ERRCODE = '42501'; END IF;
  RETURN jsonb_build_object('success', true, 'creative_id', p_creative_id, 'status', 'pending_review');
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_review_ad_creative(p_creative_id uuid, p_approved boolean, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_campaign_id uuid;
BEGIN
  IF NOT public.gsa_admin_has_module('anuncios') THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501'; END IF;
  UPDATE public.gsa_ad_creatives
     SET status = CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END,
         approved_at = CASE WHEN p_approved THEN now() ELSE NULL END,
         rejection_reason = CASE WHEN p_approved THEN NULL ELSE nullif(trim(p_reason),'') END
   WHERE id = p_creative_id AND status = 'pending_review'
   RETURNING campaign_id INTO v_campaign_id;
  IF v_campaign_id IS NULL THEN RAISE EXCEPTION 'Criativo não encontrado ou já analisado' USING ERRCODE = 'P0002'; END IF;
  PERFORM public.gsa_ads_refresh_campaign_states();
  RETURN jsonb_build_object('success', true, 'creative_id', p_creative_id, 'approved', p_approved);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_mark_ad_payment(
  p_payment_id uuid,
  p_status text,
  p_provider_reference text DEFAULT NULL,
  p_payment_method text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_campaign_id uuid;
BEGIN
  IF NOT public.gsa_admin_has_module('anuncios') THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501'; END IF;
  IF p_status NOT IN ('pending','processing','paid','failed','refunded','cancelled') THEN RAISE EXCEPTION 'Status inválido' USING ERRCODE = '22023'; END IF;
  UPDATE public.gsa_ad_payments
     SET status = p_status,
         provider_reference = COALESCE(nullif(p_provider_reference,''), provider_reference),
         payment_method = COALESCE(nullif(p_payment_method,''), payment_method),
         paid_at = CASE WHEN p_status = 'paid' THEN COALESCE(paid_at, now()) ELSE paid_at END
   WHERE id = p_payment_id RETURNING campaign_id INTO v_campaign_id;
  IF v_campaign_id IS NULL THEN RAISE EXCEPTION 'Pagamento não encontrado' USING ERRCODE = 'P0002'; END IF;
  IF p_status = 'paid' THEN
    UPDATE public.gsa_ad_campaigns SET paid_at = COALESCE(paid_at, now()) WHERE id = v_campaign_id;
  ELSIF p_status IN ('refunded','cancelled') THEN
    UPDATE public.gsa_ad_campaigns SET status = 'cancelled' WHERE id = v_campaign_id;
  END IF;
  PERFORM public.gsa_ads_refresh_campaign_states();
  RETURN jsonb_build_object('success', true, 'payment_id', p_payment_id, 'status', p_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_ads_process_payment_event(
  p_provider text,
  p_event_id text,
  p_reference text,
  p_status text,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payment_id uuid;
  v_campaign_id uuid;
BEGIN
  IF p_status NOT IN ('pending','processing','paid','failed','refunded','cancelled') THEN
    RAISE EXCEPTION 'Status de pagamento inválido' USING ERRCODE = '22023';
  END IF;
  SELECT id, campaign_id INTO v_payment_id, v_campaign_id
    FROM public.gsa_ad_payments WHERE provider_reference = p_reference FOR UPDATE;
  IF v_payment_id IS NULL THEN RAISE EXCEPTION 'Referência de pagamento não encontrada' USING ERRCODE = 'P0002'; END IF;

  INSERT INTO public.gsa_ad_payment_events(payment_id, provider, provider_event_id, status, payload)
  VALUES (v_payment_id, p_provider, p_event_id, p_status, COALESCE(p_payload,'{}'::jsonb))
  ON CONFLICT (provider, provider_event_id) DO NOTHING;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', true, 'duplicate', true); END IF;

  UPDATE public.gsa_ad_payments
     SET status = p_status, raw_payload = COALESCE(p_payload,'{}'::jsonb),
         paid_at = CASE WHEN p_status = 'paid' THEN COALESCE(paid_at, now()) ELSE paid_at END
   WHERE id = v_payment_id;
  IF p_status = 'paid' THEN
    UPDATE public.gsa_ad_campaigns SET paid_at = COALESCE(paid_at, now()) WHERE id = v_campaign_id;
  ELSIF p_status IN ('refunded','cancelled') THEN
    UPDATE public.gsa_ad_campaigns SET status = 'cancelled' WHERE id = v_campaign_id;
  END IF;
  PERFORM public.gsa_ads_refresh_campaign_states();
  RETURN jsonb_build_object('success', true, 'payment_id', v_payment_id, 'status', p_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_advertising_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.gsa_admin_has_module('anuncios') THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501'; END IF;
  RETURN jsonb_build_object(
    'requests', COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC) FROM public.gsa_ad_requests r), '[]'::jsonb),
    'proposals', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id', p.id, 'request_id', p.request_id, 'status', p.status, 'current_version', p.current_version,
      'total_amount', p.total_amount, 'valid_until', p.valid_until,
      'version', to_jsonb(v), 'company_name', r.company_name,
      'advertiser_id', r.advertiser_id, 'advertiser_status', a.status, 'auth_user_id', a.auth_user_id
    ) ORDER BY p.created_at DESC)
      FROM public.gsa_ad_proposals p
      JOIN public.gsa_ad_requests r ON r.id = p.request_id
      LEFT JOIN public.gsa_advertisers a ON a.id = r.advertiser_id
      LEFT JOIN public.gsa_ad_proposal_versions v ON v.proposal_id = p.id AND v.version = p.current_version), '[]'::jsonb),
    'campaigns', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id', c.id, 'name', c.name, 'status', c.status, 'starts_at', c.starts_at, 'ends_at', c.ends_at,
      'advertiser_name', COALESCE(a.trade_name,a.legal_name), 'paid_at', c.paid_at,
      'creatives', COALESCE((SELECT jsonb_agg(to_jsonb(cr) ORDER BY cr.created_at DESC) FROM public.gsa_ad_creatives cr WHERE cr.campaign_id = c.id), '[]'::jsonb),
      'payment', (SELECT to_jsonb(pay) FROM public.gsa_ad_payments pay WHERE pay.campaign_id = c.id),
      'metrics', COALESCE((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.metric_date) FROM public.gsa_ad_daily_metrics m WHERE m.campaign_id = c.id), '[]'::jsonb)
    ) ORDER BY c.created_at DESC)
      FROM public.gsa_ad_campaigns c JOIN public.gsa_advertisers a ON a.id = c.advertiser_id), '[]'::jsonb),
    'placements', COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.module,p.position) FROM public.gsa_ad_placements p), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_ads_serve(
  p_placement_code text,
  p_viewer_hash text,
  p_session_hash text,
  p_route text,
  p_device text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pick record;
  v_token uuid;
BEGIN
  PERFORM public.gsa_ads_refresh_campaign_states();

  SELECT c.id AS campaign_id, c.name, c.slug, c.frequency_model, c.frequency_value,
         a.trade_name, a.legal_name, p.id AS placement_id, p.code AS placement_code,
         cr.id AS creative_id, cr.kind, cr.storage_path, cr.target_url, cr.headline, cr.body, cr.alt_text,
         cr.width, cr.height, cr.duration_seconds
    INTO v_pick
    FROM public.gsa_ad_campaigns c
    JOIN public.gsa_advertisers a ON a.id = c.advertiser_id AND a.status = 'active'
    JOIN public.gsa_ad_campaign_placements cp ON cp.campaign_id = c.id
    JOIN public.gsa_ad_placements p ON p.id = cp.placement_id AND p.code = p_placement_code AND p.active
    JOIN LATERAL (
      SELECT x.* FROM public.gsa_ad_creatives x
       WHERE x.campaign_id = c.id AND x.status = 'approved'
       ORDER BY x.approved_at DESC NULLS LAST, x.created_at DESC LIMIT 1
    ) cr ON true
   WHERE c.status = 'active'
     AND c.paid_at IS NOT NULL
     AND COALESCE(c.starts_at, now()) <= now()
     AND (c.ends_at IS NULL OR c.ends_at > now())
     AND (p_device IS NULL OR p_device = ANY(p.devices))
     AND (c.impression_limit IS NULL OR COALESCE((SELECT sum(m.served) FROM public.gsa_ad_daily_metrics m WHERE m.campaign_id = c.id),0) < c.impression_limit)
     AND (
       c.frequency_model = 'unlimited'
       OR (c.frequency_model = 'once_per_session' AND NOT EXISTS (
         SELECT 1 FROM public.gsa_ad_delivery_events e WHERE e.campaign_id = c.id AND e.session_hash = p_session_hash
       ))
       OR (c.frequency_model = 'once_per_day' AND NOT EXISTS (
         SELECT 1 FROM public.gsa_ad_delivery_events e WHERE e.campaign_id = c.id AND e.viewer_hash = p_viewer_hash AND e.served_at >= current_date
       ))
       OR (c.frequency_model = 'interval_hours' AND NOT EXISTS (
         SELECT 1 FROM public.gsa_ad_delivery_events e WHERE e.campaign_id = c.id AND e.viewer_hash = p_viewer_hash
           AND e.served_at >= now() - make_interval(hours => GREATEST(COALESCE(c.frequency_value,1),1))
       ))
       OR (c.frequency_model = 'daily_limit' AND (
         SELECT count(*) FROM public.gsa_ad_delivery_events e WHERE e.campaign_id = c.id AND e.viewer_hash = p_viewer_hash AND e.served_at >= current_date
       ) < GREATEST(COALESCE(c.frequency_value,1),1))
     )
   ORDER BY cp.priority ASC, md5(c.id::text || p_viewer_hash || current_date::text)
   LIMIT 1;

  IF v_pick.campaign_id IS NULL THEN RETURN jsonb_build_object('success', true, 'ad', NULL); END IF;

  INSERT INTO public.gsa_ad_delivery_events(
    campaign_id, placement_id, creative_id, viewer_hash, session_hash, route, device
  ) VALUES (
    v_pick.campaign_id, v_pick.placement_id, v_pick.creative_id, p_viewer_hash, p_session_hash,
    nullif(p_route,''), nullif(p_device,'')
  ) RETURNING event_token INTO v_token;

  INSERT INTO public.gsa_ad_daily_metrics(campaign_id, placement_id, metric_date, requests, served)
  VALUES (v_pick.campaign_id, v_pick.placement_id, current_date, 1, 1)
  ON CONFLICT (campaign_id, placement_id, metric_date) DO UPDATE
    SET requests = public.gsa_ad_daily_metrics.requests + 1,
        served = public.gsa_ad_daily_metrics.served + 1;

  RETURN jsonb_build_object('success', true, 'event_token', v_token, 'ad', jsonb_build_object(
    'campaign_id', v_pick.campaign_id, 'name', v_pick.name, 'slug', v_pick.slug,
    'advertiser_name', COALESCE(v_pick.trade_name, v_pick.legal_name),
    'placement_code', v_pick.placement_code, 'creative_id', v_pick.creative_id,
    'kind', v_pick.kind, 'storage_path', v_pick.storage_path, 'target_url', v_pick.target_url,
    'headline', v_pick.headline, 'body', v_pick.body, 'alt_text', v_pick.alt_text,
    'width', v_pick.width, 'height', v_pick.height, 'duration_seconds', v_pick.duration_seconds
  ));
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_ads_record_event(p_event_token uuid, p_event_type text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event public.gsa_ad_delivery_events;
  v_changed integer := 0;
BEGIN
  SELECT * INTO v_event FROM public.gsa_ad_delivery_events
   WHERE event_token = p_event_token AND requested_at > now() - interval '2 days' FOR UPDATE;
  IF v_event.id IS NULL THEN RAISE EXCEPTION 'Evento inválido' USING ERRCODE = 'P0002'; END IF;

  IF p_event_type = 'viewable' THEN
    UPDATE public.gsa_ad_delivery_events SET viewable_at = now() WHERE id = v_event.id AND viewable_at IS NULL;
  ELSIF p_event_type = 'click' THEN
    UPDATE public.gsa_ad_delivery_events SET clicked_at = now() WHERE id = v_event.id AND clicked_at IS NULL;
  ELSIF p_event_type = 'video_start' THEN
    UPDATE public.gsa_ad_delivery_events SET video_started_at = now() WHERE id = v_event.id AND video_started_at IS NULL;
  ELSIF p_event_type = 'video_complete' THEN
    UPDATE public.gsa_ad_delivery_events SET video_completed_at = now() WHERE id = v_event.id AND video_completed_at IS NULL;
  ELSE
    RAISE EXCEPTION 'Tipo de evento inválido' USING ERRCODE = '22023';
  END IF;
  GET DIAGNOSTICS v_changed = ROW_COUNT;

  IF v_changed > 0 THEN
    UPDATE public.gsa_ad_daily_metrics
       SET viewable_impressions = viewable_impressions + CASE WHEN p_event_type = 'viewable' THEN 1 ELSE 0 END,
           clicks = clicks + CASE WHEN p_event_type = 'click' THEN 1 ELSE 0 END,
           video_starts = video_starts + CASE WHEN p_event_type = 'video_start' THEN 1 ELSE 0 END,
           video_completions = video_completions + CASE WHEN p_event_type = 'video_complete' THEN 1 ELSE 0 END
     WHERE campaign_id = v_event.campaign_id AND placement_id = v_event.placement_id AND metric_date = v_event.served_at::date;
  END IF;

  RETURN jsonb_build_object('success', true, 'recorded', v_changed > 0);
END;
$$;

DO $security$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['gsa_ad_payments','gsa_ad_payment_events','gsa_ad_delivery_events'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', v_table);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', v_table);
    EXECUTE format('DROP POLICY IF EXISTS gsa_ads_admin_access ON public.%I', v_table);
    EXECUTE format('CREATE POLICY gsa_ads_admin_access ON public.%I FOR ALL TO authenticated USING (public.gsa_admin_has_module(''anuncios'')) WITH CHECK (public.gsa_admin_has_module(''anuncios''))', v_table);
  END LOOP;

  IF to_regclass('storage.buckets') IS NOT NULL AND to_regclass('storage.objects') IS NOT NULL THEN
    INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('gsa-ad-creatives', 'gsa-ad-creatives', false, 52428800, ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'])
    ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

    DROP POLICY IF EXISTS gsa_advertiser_creative_objects ON storage.objects;
    CREATE POLICY gsa_advertiser_creative_objects ON storage.objects
      FOR ALL TO authenticated
      USING (
        bucket_id = 'gsa-ad-creatives'
        AND (
          split_part(name, '/', 1) = public.gsa_current_advertiser_id()::text
          OR public.gsa_admin_has_module('anuncios')
        )
      )
      WITH CHECK (
        bucket_id = 'gsa-ad-creatives'
        AND (
          split_part(name, '/', 1) = public.gsa_current_advertiser_id()::text
          OR public.gsa_admin_has_module('anuncios')
        )
      );
  END IF;
END;
$security$;

REVOKE ALL ON FUNCTION public.gsa_current_advertiser_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_current_advertiser_id() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.gsa_ads_refresh_campaign_states() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_ads_refresh_campaign_states() TO service_role;

REVOKE ALL ON FUNCTION public.gsa_admin_create_ad_proposal(uuid,jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_get_advertiser_invite_target(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_link_advertiser_auth(uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_review_ad_creative(uuid,boolean,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_mark_ad_payment(uuid,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_advertising_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_create_ad_proposal(uuid,jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_get_advertiser_invite_target(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_link_advertiser_auth(uuid,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_review_ad_creative(uuid,boolean,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_mark_ad_payment(uuid,text,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_advertising_overview() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.gsa_advertiser_portal_snapshot() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_advertiser_counter_proposal(uuid,numeric,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_advertiser_accept_proposal(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_advertiser_save_creative(uuid,uuid,text,text,text,text,text,text,integer,integer,numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_advertiser_submit_creative(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_advertiser_portal_snapshot() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_advertiser_counter_proposal(uuid,numeric,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_advertiser_accept_proposal(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_advertiser_save_creative(uuid,uuid,text,text,text,text,text,text,integer,integer,numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_advertiser_submit_creative(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.gsa_ads_process_payment_event(text,text,text,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_ads_serve(text,text,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_ads_record_event(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_ads_process_payment_event(text,text,text,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.gsa_ads_serve(text,text,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gsa_ads_record_event(uuid,text) TO service_role;

COMMIT;
