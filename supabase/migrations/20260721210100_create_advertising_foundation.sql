BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.gsa_advertisers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE,
  legal_name text NOT NULL,
  trade_name text,
  document text NOT NULL,
  company_size text NOT NULL CHECK (company_size IN ('autonomo','mei','micro','pequena','media','grande')),
  segment text NOT NULL,
  website text,
  responsible_name text NOT NULL,
  responsible_email text NOT NULL,
  responsible_phone text NOT NULL,
  city text,
  state text,
  status text NOT NULL DEFAULT 'pending_verification' CHECK (status IN ('pending_verification','active','suspended','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS gsa_advertisers_document_unique
  ON public.gsa_advertisers (regexp_replace(document, '[^0-9]', '', 'g'));

CREATE TABLE IF NOT EXISTS public.gsa_ad_placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  route_pattern text NOT NULL,
  module text NOT NULL,
  format text NOT NULL CHECK (format IN ('responsive_banner','sponsored_card','rectangle','sticky_banner','hero','inline_video','floating_video','lightbox','section_sponsorship','sponsored_content','takeover')),
  position text NOT NULL,
  devices text[] NOT NULL DEFAULT ARRAY['desktop','tablet','mobile']::text[],
  capacity integer NOT NULL DEFAULT 1 CHECK (capacity > 0),
  exclusive boolean NOT NULL DEFAULT false,
  base_daily_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (base_daily_price >= 0),
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gsa_ad_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id uuid REFERENCES public.gsa_advertisers(id) ON DELETE SET NULL,
  protocol text NOT NULL UNIQUE,
  company_name text NOT NULL,
  document text NOT NULL,
  company_size text NOT NULL CHECK (company_size IN ('autonomo','mei','micro','pequena','media','grande')),
  segment text NOT NULL,
  contact_name text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text NOT NULL,
  website text,
  objective text NOT NULL,
  desired_formats text[] NOT NULL DEFAULT '{}'::text[],
  desired_pages text[] NOT NULL DEFAULT '{}'::text[],
  devices text[] NOT NULL DEFAULT ARRAY['desktop','mobile']::text[],
  desired_start_date date,
  desired_end_date date,
  intended_budget numeric(12,2) NOT NULL CHECK (intended_budget > 0),
  needs_creative_service boolean NOT NULL DEFAULT false,
  notes text,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft','submitted','under_review','awaiting_information','proposal_sent','negotiation_requested','accepted','rejected','cancelled')),
  source_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gsa_ad_request_placements (
  request_id uuid NOT NULL REFERENCES public.gsa_ad_requests(id) ON DELETE CASCADE,
  placement_id uuid NOT NULL REFERENCES public.gsa_ad_placements(id) ON DELETE RESTRICT,
  PRIMARY KEY (request_id, placement_id)
);

CREATE TABLE IF NOT EXISTS public.gsa_ad_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.gsa_ad_requests(id) ON DELETE CASCADE,
  current_version integer NOT NULL DEFAULT 1 CHECK (current_version > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','negotiating','final_offer','accepted','rejected','expired','cancelled')),
  total_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  valid_until timestamptz,
  accepted_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gsa_ad_proposal_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.gsa_ad_proposals(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  duration_days integer NOT NULL CHECK (duration_days > 0),
  starts_on date,
  ends_on date,
  formats text[] NOT NULL DEFAULT '{}'::text[],
  placement_codes text[] NOT NULL DEFAULT '{}'::text[],
  frequency_model text NOT NULL DEFAULT 'once_per_day' CHECK (frequency_model IN ('once_per_session','once_per_day','interval_hours','daily_limit','unlimited')),
  frequency_value integer,
  impression_limit bigint,
  terms text,
  created_by_type text NOT NULL CHECK (created_by_type IN ('admin','advertiser')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proposal_id, version)
);

CREATE TABLE IF NOT EXISTS public.gsa_ad_negotiations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.gsa_ad_proposals(id) ON DELETE CASCADE,
  actor_type text NOT NULL CHECK (actor_type IN ('admin','advertiser')),
  actor_id uuid,
  proposed_amount numeric(12,2),
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gsa_ad_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id uuid NOT NULL REFERENCES public.gsa_advertisers(id) ON DELETE RESTRICT,
  proposal_id uuid UNIQUE REFERENCES public.gsa_ad_proposals(id) ON DELETE SET NULL,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','payment_pending','creative_review','scheduled','active','paused','completed','cancelled')),
  starts_at timestamptz,
  ends_at timestamptz,
  frequency_model text NOT NULL DEFAULT 'once_per_day' CHECK (frequency_model IN ('once_per_session','once_per_day','interval_hours','daily_limit','unlimited')),
  frequency_value integer,
  impression_limit bigint,
  paid_at timestamptz,
  activated_at timestamptz,
  paused_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS public.gsa_ad_creatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.gsa_ad_campaigns(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('image','video','text')),
  status text NOT NULL DEFAULT 'pending_review' CHECK (status IN ('draft','pending_review','approved','rejected','archived')),
  storage_path text,
  target_url text,
  headline text,
  body text,
  alt_text text,
  width integer,
  height integer,
  duration_seconds numeric(8,2),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  rejection_reason text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (target_url IS NULL OR target_url ~ '^https://')
);

CREATE TABLE IF NOT EXISTS public.gsa_ad_campaign_placements (
  campaign_id uuid NOT NULL REFERENCES public.gsa_ad_campaigns(id) ON DELETE CASCADE,
  placement_id uuid NOT NULL REFERENCES public.gsa_ad_placements(id) ON DELETE RESTRICT,
  priority integer NOT NULL DEFAULT 100,
  share_percent numeric(5,2) NOT NULL DEFAULT 100 CHECK (share_percent > 0 AND share_percent <= 100),
  PRIMARY KEY (campaign_id, placement_id)
);

CREATE TABLE IF NOT EXISTS public.gsa_ad_daily_metrics (
  campaign_id uuid NOT NULL REFERENCES public.gsa_ad_campaigns(id) ON DELETE CASCADE,
  placement_id uuid NOT NULL REFERENCES public.gsa_ad_placements(id) ON DELETE CASCADE,
  metric_date date NOT NULL,
  requests bigint NOT NULL DEFAULT 0,
  served bigint NOT NULL DEFAULT 0,
  viewable_impressions bigint NOT NULL DEFAULT 0,
  clicks bigint NOT NULL DEFAULT 0,
  video_starts bigint NOT NULL DEFAULT 0,
  video_completions bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (campaign_id, placement_id, metric_date)
);

CREATE TABLE IF NOT EXISTS public.gsa_ad_audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_type text NOT NULL,
  actor_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.gsa_ads_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DO $triggers$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['gsa_advertisers','gsa_ad_placements','gsa_ad_requests','gsa_ad_proposals','gsa_ad_campaigns','gsa_ad_creatives'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I', v_table, v_table);
    EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.gsa_ads_touch_updated_at()', v_table, v_table);
  END LOOP;
END;
$triggers$;

INSERT INTO public.gsa_ad_placements (code, name, description, route_pattern, module, format, position, capacity, exclusive, base_daily_price)
VALUES
  ('ADS_PUBLIC_SHOWCASE', 'Vitrine pública de anunciantes', 'Cards exibidos na página pública de anúncios.', '/anuncios', 'public', 'sponsored_card', 'content', 12, false, 0),
  ('HOME_BANNER_TOP', 'Banner superior da Home', 'Banner responsivo abaixo da navegação principal.', '/', 'home', 'responsive_banner', 'top', 3, false, 0),
  ('HOME_INLINE_01', 'Destaque interno da Home', 'Card patrocinado integrado ao conteúdo da Home.', '/', 'home', 'sponsored_card', 'content', 4, false, 0),
  ('HOME_LIGHTBOX', 'Lightbox controlado da Home', 'Formato especial com fechamento imediato e frequência limitada.', '/', 'home', 'lightbox', 'overlay', 1, true, 0),
  ('SITE_STICKY_BOTTOM', 'Banner fixo inferior', 'Banner pequeno e responsivo no rodapé da página.', '/*', 'site', 'sticky_banner', 'bottom', 2, false, 0),
  ('MARKETPLACE_SPONSORED_CARD', 'Card patrocinado do Marketplace', 'Card contextual nas vitrines do Marketplace.', '/marketplace/*', 'marketplace', 'sponsored_card', 'content', 6, false, 0),
  ('CLASSIFIEDS_BANNER_TOP', 'Banner superior dos Classificados', 'Banner contextual da área de Classificados.', '/marketplace/menu/classificados/*', 'classificados', 'responsive_banner', 'top', 3, false, 0)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  route_pattern = EXCLUDED.route_pattern,
  module = EXCLUDED.module,
  format = EXCLUDED.format,
  position = EXCLUDED.position,
  capacity = EXCLUDED.capacity,
  exclusive = EXCLUDED.exclusive;

CREATE OR REPLACE FUNCTION public.gsa_public_submit_advertising_request(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_protocol text;
  v_request_id uuid;
  v_formats text[];
  v_pages text[];
  v_devices text[];
  v_placement_code text;
BEGIN
  IF length(trim(COALESCE(p_payload->>'company_name',''))) < 2
     OR length(regexp_replace(COALESCE(p_payload->>'document',''), '[^0-9]', '', 'g')) < 11
     OR COALESCE(p_payload->>'company_size','') NOT IN ('autonomo','mei','micro','pequena','media','grande')
     OR length(trim(COALESCE(p_payload->>'segment',''))) < 2
     OR length(trim(COALESCE(p_payload->>'contact_name',''))) < 2
     OR COALESCE(p_payload->>'contact_email','') !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     OR length(regexp_replace(COALESCE(p_payload->>'contact_phone',''), '[^0-9]', '', 'g')) < 10
     OR length(trim(COALESCE(p_payload->>'objective',''))) < 3
     OR COALESCE((p_payload->>'intended_budget')::numeric, 0) <= 0 THEN
    RAISE EXCEPTION 'Dados da solicitação inválidos' USING ERRCODE = '22023';
  END IF;

  v_formats := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'desired_formats','[]'::jsonb)));
  v_pages := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'desired_pages','[]'::jsonb)));
  v_devices := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'devices','["desktop","mobile"]'::jsonb)));

  IF cardinality(v_formats) = 0 OR cardinality(v_pages) = 0 THEN
    RAISE EXCEPTION 'Selecione ao menos um formato e uma página' USING ERRCODE = '22023';
  END IF;

  v_protocol := 'ADS-' || to_char(current_date, 'YYYYMMDD') || '-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 8));

  INSERT INTO public.gsa_ad_requests (
    protocol, company_name, document, company_size, segment, contact_name, contact_email,
    contact_phone, website, objective, desired_formats, desired_pages, devices,
    desired_start_date, desired_end_date, intended_budget, needs_creative_service, notes, source_metadata
  ) VALUES (
    v_protocol,
    trim(p_payload->>'company_name'),
    regexp_replace(p_payload->>'document', '[^0-9]', '', 'g'),
    p_payload->>'company_size',
    trim(p_payload->>'segment'),
    trim(p_payload->>'contact_name'),
    lower(trim(p_payload->>'contact_email')),
    regexp_replace(p_payload->>'contact_phone', '[^0-9]', '', 'g'),
    nullif(trim(p_payload->>'website'), ''),
    trim(p_payload->>'objective'),
    v_formats,
    v_pages,
    v_devices,
    nullif(p_payload->>'desired_start_date','')::date,
    nullif(p_payload->>'desired_end_date','')::date,
    (p_payload->>'intended_budget')::numeric,
    COALESCE((p_payload->>'needs_creative_service')::boolean, false),
    nullif(trim(p_payload->>'notes'), ''),
    COALESCE(p_payload->'source_metadata','{}'::jsonb)
  ) RETURNING id INTO v_request_id;

  FOREACH v_placement_code IN ARRAY v_pages LOOP
    INSERT INTO public.gsa_ad_request_placements (request_id, placement_id)
    SELECT v_request_id, id FROM public.gsa_ad_placements WHERE code = v_placement_code AND active
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'request_id', v_request_id, 'protocol', v_protocol, 'status', 'submitted');
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_public_list_active_ads(p_placement_code text DEFAULT 'ADS_PUBLIC_SHOWCASE')
RETURNS SETOF jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'campaign_id', c.id,
    'slug', c.slug,
    'name', c.name,
    'advertiser_name', COALESCE(a.trade_name, a.legal_name),
    'creative_id', cr.id,
    'kind', cr.kind,
    'storage_path', cr.storage_path,
    'target_url', cr.target_url,
    'headline', cr.headline,
    'body', cr.body,
    'alt_text', cr.alt_text,
    'placement_code', p.code
  )
  FROM public.gsa_ad_campaigns c
  JOIN public.gsa_advertisers a ON a.id = c.advertiser_id AND a.status = 'active'
  JOIN public.gsa_ad_campaign_placements cp ON cp.campaign_id = c.id
  JOIN public.gsa_ad_placements p ON p.id = cp.placement_id AND p.active
  JOIN LATERAL (
    SELECT creative.* FROM public.gsa_ad_creatives creative
    WHERE creative.campaign_id = c.id AND creative.status = 'approved'
    ORDER BY creative.approved_at DESC NULLS LAST, creative.created_at DESC
    LIMIT 1
  ) cr ON true
  WHERE p.code = p_placement_code
    AND c.status = 'active'
    AND c.paid_at IS NOT NULL
    AND c.starts_at <= now()
    AND c.ends_at > now()
  ORDER BY cp.priority, c.created_at
  LIMIT 24;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_list_ad_requests(p_status text DEFAULT NULL)
RETURNS SETOF jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.gsa_admin_has_module('anuncios') THEN
    RAISE EXCEPTION 'Acesso negado ao módulo de anúncios' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT jsonb_build_object(
    'id', r.id,
    'protocol', r.protocol,
    'company_name', r.company_name,
    'company_size', r.company_size,
    'segment', r.segment,
    'contact_name', r.contact_name,
    'contact_email', r.contact_email,
    'contact_phone', r.contact_phone,
    'objective', r.objective,
    'desired_formats', r.desired_formats,
    'desired_pages', r.desired_pages,
    'devices', r.devices,
    'desired_start_date', r.desired_start_date,
    'desired_end_date', r.desired_end_date,
    'intended_budget', r.intended_budget,
    'needs_creative_service', r.needs_creative_service,
    'notes', r.notes,
    'status', r.status,
    'created_at', r.created_at
  )
  FROM public.gsa_ad_requests r
  WHERE p_status IS NULL OR r.status = p_status
  ORDER BY r.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_update_ad_request_status(p_request_id uuid, p_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request public.gsa_ad_requests;
BEGIN
  IF NOT public.gsa_admin_has_module('anuncios') THEN
    RAISE EXCEPTION 'Acesso negado ao módulo de anúncios' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('submitted','under_review','awaiting_information','proposal_sent','negotiation_requested','accepted','rejected','cancelled') THEN
    RAISE EXCEPTION 'Status inválido' USING ERRCODE = '22023';
  END IF;

  UPDATE public.gsa_ad_requests SET status = p_status WHERE id = p_request_id RETURNING * INTO v_request;
  IF v_request.id IS NULL THEN RAISE EXCEPTION 'Solicitação não encontrada' USING ERRCODE = 'P0002'; END IF;

  INSERT INTO public.gsa_ad_audit_logs (actor_type, actor_id, action, entity_type, entity_id, details)
  VALUES (public.gsa_current_actor_type(), public.gsa_current_actor_id(), 'UPDATE_STATUS', 'ad_request', p_request_id, jsonb_build_object('status', p_status));

  RETURN jsonb_build_object('success', true, 'id', v_request.id, 'status', v_request.status);
END;
$$;

DO $security$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'gsa_advertisers','gsa_ad_placements','gsa_ad_requests','gsa_ad_request_placements',
    'gsa_ad_proposals','gsa_ad_proposal_versions','gsa_ad_negotiations','gsa_ad_campaigns',
    'gsa_ad_creatives','gsa_ad_campaign_placements','gsa_ad_daily_metrics','gsa_ad_audit_logs'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', v_table);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', v_table);
    EXECUTE format('DROP POLICY IF EXISTS gsa_ads_admin_access ON public.%I', v_table);
    EXECUTE format('CREATE POLICY gsa_ads_admin_access ON public.%I FOR ALL TO authenticated USING (public.gsa_admin_has_module(''anuncios'')) WITH CHECK (public.gsa_admin_has_module(''anuncios''))', v_table);
  END LOOP;
END;
$security$;

REVOKE ALL ON FUNCTION public.gsa_public_submit_advertising_request(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_public_submit_advertising_request(jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.gsa_public_list_active_ads(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_public_list_active_ads(text) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.gsa_admin_list_ad_requests(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_list_ad_requests(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.gsa_admin_update_ad_request_status(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_update_ad_request_status(uuid,text) TO authenticated, service_role;

COMMIT;
