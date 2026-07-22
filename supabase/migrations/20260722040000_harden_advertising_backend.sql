BEGIN;

-- Backend hardening for GSA Anuncios. This migration intentionally replaces
-- routines in-place while preserving every public RPC signature already used
-- by the application.

ALTER TABLE public.gsa_ad_proposals
  ADD COLUMN IF NOT EXISTS accepted_version integer,
  ADD COLUMN IF NOT EXISTS accepted_amount numeric(12,2);

UPDATE public.gsa_ad_proposals
   SET accepted_version = COALESCE(accepted_version, current_version),
       accepted_amount = COALESCE(accepted_amount, total_amount),
       accepted_at = COALESCE(accepted_at, updated_at, now())
 WHERE status = 'accepted';

ALTER TABLE public.gsa_ad_proposals
  DROP CONSTRAINT IF EXISTS gsa_ad_proposals_accepted_snapshot_check;
ALTER TABLE public.gsa_ad_proposals
  ADD CONSTRAINT gsa_ad_proposals_accepted_snapshot_check CHECK (
    status <> 'accepted'
    OR (
      accepted_version IS NOT NULL
      AND accepted_version > 0
      AND accepted_amount IS NOT NULL
      AND accepted_amount > 0
      AND accepted_at IS NOT NULL
    )
  );

ALTER TABLE public.gsa_ad_proposal_versions
  ADD COLUMN IF NOT EXISTS placement_shares jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.gsa_ad_proposal_versions
  DROP CONSTRAINT IF EXISTS gsa_ad_proposal_versions_placement_shares_check;
ALTER TABLE public.gsa_ad_proposal_versions
  ADD CONSTRAINT gsa_ad_proposal_versions_placement_shares_check
  CHECK (jsonb_typeof(placement_shares) = 'object');

ALTER TABLE public.gsa_ad_campaigns
  ADD COLUMN IF NOT EXISTS devices text[] NOT NULL DEFAULT ARRAY['desktop','tablet','mobile']::text[],
  ADD COLUMN IF NOT EXISTS served_count bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS resumed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

UPDATE public.gsa_ad_campaigns c
   SET served_count = GREATEST(
     c.served_count,
     COALESCE((SELECT sum(m.served) FROM public.gsa_ad_daily_metrics m WHERE m.campaign_id = c.id), 0)
   );

ALTER TABLE public.gsa_ad_campaigns DROP CONSTRAINT IF EXISTS gsa_ad_campaigns_status_check;
ALTER TABLE public.gsa_ad_campaigns
  ADD CONSTRAINT gsa_ad_campaigns_status_check CHECK (
    status IN (
      'draft','payment_pending','payment_overdue','creative_review','scheduled',
      'active','paused','completed','cancelled'
    )
  );
ALTER TABLE public.gsa_ad_campaigns DROP CONSTRAINT IF EXISTS gsa_ad_campaigns_devices_check;
ALTER TABLE public.gsa_ad_campaigns
  ADD CONSTRAINT gsa_ad_campaigns_devices_check CHECK (
    cardinality(devices) BETWEEN 1 AND 3
    AND devices <@ ARRAY['desktop','tablet','mobile']::text[]
  );
ALTER TABLE public.gsa_ad_campaigns DROP CONSTRAINT IF EXISTS gsa_ad_campaigns_served_count_check;
ALTER TABLE public.gsa_ad_campaigns
  ADD CONSTRAINT gsa_ad_campaigns_served_count_check CHECK (served_count >= 0);

ALTER TABLE public.gsa_ad_payments
  ADD COLUMN IF NOT EXISTS overdue_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_provider_event_at timestamptz;
ALTER TABLE public.gsa_ad_payments DROP CONSTRAINT IF EXISTS gsa_ad_payments_status_check;
ALTER TABLE public.gsa_ad_payments
  ADD CONSTRAINT gsa_ad_payments_status_check CHECK (
    status IN ('pending','processing','paid','failed','overdue','refunded','cancelled')
  );

ALTER TABLE public.gsa_ad_delivery_events
  ADD COLUMN IF NOT EXISTS request_hash text;

CREATE TABLE IF NOT EXISTS public.gsa_ad_rate_limit_buckets (
  scope_hash text NOT NULL,
  action text NOT NULL,
  bucket_start timestamptz NOT NULL,
  hit_count integer NOT NULL DEFAULT 0 CHECK (hit_count > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope_hash, action, bucket_start),
  CHECK (scope_hash ~ '^[a-f0-9]{64}$'),
  CHECK (action ~ '^[a-z0-9_]{1,40}$')
);

CREATE TABLE IF NOT EXISTS public.gsa_ad_maintenance_state (
  task_name text PRIMARY KEY,
  last_run_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gsa_ad_proposals_expiration_idx
  ON public.gsa_ad_proposals(valid_until)
  WHERE status IN ('sent','negotiating','final_offer');
CREATE INDEX IF NOT EXISTS gsa_ad_payments_due_idx
  ON public.gsa_ad_payments(due_at)
  WHERE status IN ('pending','processing');
CREATE INDEX IF NOT EXISTS gsa_ad_campaigns_delivery_idx
  ON public.gsa_ad_campaigns(status, starts_at, ends_at)
  WHERE status IN ('active','scheduled');
CREATE INDEX IF NOT EXISTS gsa_ad_campaign_placements_placement_idx
  ON public.gsa_ad_campaign_placements(placement_id, campaign_id);
CREATE INDEX IF NOT EXISTS gsa_ad_delivery_event_token_recent_idx
  ON public.gsa_ad_delivery_events(event_token, requested_at DESC);
CREATE INDEX IF NOT EXISTS gsa_ad_delivery_request_hash_idx
  ON public.gsa_ad_delivery_events(request_hash, requested_at DESC)
  WHERE request_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS gsa_ad_payment_events_created_idx
  ON public.gsa_ad_payment_events(created_at);
CREATE INDEX IF NOT EXISTS gsa_ad_rate_limit_cleanup_idx
  ON public.gsa_ad_rate_limit_buckets(updated_at);

CREATE OR REPLACE FUNCTION public.gsa_ads_valid_cpf_cnpj(p_value text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_digits text := regexp_replace(COALESCE(p_value, ''), '[^0-9]', '', 'g');
  v_sum integer;
  v_digit integer;
  v_index integer;
  v_weights integer[];
BEGIN
  IF length(v_digits) NOT IN (11, 14) THEN RETURN false; END IF;
  IF replace(v_digits, substr(v_digits, 1, 1), '') = '' THEN RETURN false; END IF;

  IF length(v_digits) = 11 THEN
    v_sum := 0;
    FOR v_index IN 1..9 LOOP
      v_sum := v_sum + substr(v_digits, v_index, 1)::integer * (11 - v_index);
    END LOOP;
    v_digit := CASE WHEN (v_sum % 11) < 2 THEN 0 ELSE 11 - (v_sum % 11) END;
    IF v_digit <> substr(v_digits, 10, 1)::integer THEN RETURN false; END IF;
    v_sum := 0;
    FOR v_index IN 1..10 LOOP
      v_sum := v_sum + substr(v_digits, v_index, 1)::integer * (12 - v_index);
    END LOOP;
    v_digit := CASE WHEN (v_sum % 11) < 2 THEN 0 ELSE 11 - (v_sum % 11) END;
    RETURN v_digit = substr(v_digits, 11, 1)::integer;
  END IF;

  v_weights := ARRAY[5,4,3,2,9,8,7,6,5,4,3,2];
  v_sum := 0;
  FOR v_index IN 1..12 LOOP
    v_sum := v_sum + substr(v_digits, v_index, 1)::integer * v_weights[v_index];
  END LOOP;
  v_digit := CASE WHEN (v_sum % 11) < 2 THEN 0 ELSE 11 - (v_sum % 11) END;
  IF v_digit <> substr(v_digits, 13, 1)::integer THEN RETURN false; END IF;

  v_weights := ARRAY[6,5,4,3,2,9,8,7,6,5,4,3,2];
  v_sum := 0;
  FOR v_index IN 1..13 LOOP
    v_sum := v_sum + substr(v_digits, v_index, 1)::integer * v_weights[v_index];
  END LOOP;
  v_digit := CASE WHEN (v_sum % 11) < 2 THEN 0 ELSE 11 - (v_sum % 11) END;
  RETURN v_digit = substr(v_digits, 14, 1)::integer;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_ads_route_matches(p_pattern text, p_route text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_pattern IS NULL OR p_route IS NULL THEN false
    WHEN p_pattern = '/*' THEN left(p_route, 1) = '/'
    WHEN right(p_pattern, 2) = '/*' THEN
      p_route = left(p_pattern, length(p_pattern) - 2)
      OR p_route LIKE left(p_pattern, length(p_pattern) - 1) || '%'
    ELSE p_route = p_pattern
  END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_ads_payment_transition_allowed(p_old text, p_new text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT p_old = p_new OR CASE p_old
    WHEN 'pending' THEN p_new IN ('processing','paid','failed','overdue','cancelled')
    WHEN 'processing' THEN p_new IN ('paid','failed','overdue','cancelled')
    WHEN 'failed' THEN p_new IN ('processing','paid','overdue','cancelled')
    WHEN 'overdue' THEN p_new IN ('processing','paid','failed','cancelled')
    WHEN 'paid' THEN p_new = 'refunded'
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_ads_guard_proposal_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_allowed boolean := false;
BEGIN
  IF OLD.status = NEW.status THEN
    v_allowed := true;
  ELSE
    v_allowed := CASE OLD.status
      WHEN 'draft' THEN NEW.status IN ('sent','cancelled')
      WHEN 'sent' THEN NEW.status IN ('negotiating','final_offer','accepted','rejected','expired','cancelled')
      WHEN 'negotiating' THEN NEW.status IN ('sent','final_offer','accepted','rejected','expired','cancelled')
      WHEN 'final_offer' THEN NEW.status IN ('sent','negotiating','accepted','rejected','expired','cancelled')
      WHEN 'expired' THEN NEW.status = 'sent' AND NEW.current_version > OLD.current_version
      ELSE false
    END;
  END IF;
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Transicao de proposta invalida: % -> %', OLD.status, NEW.status USING ERRCODE = '22023';
  END IF;
  IF OLD.status = 'accepted' AND (
    NEW.current_version IS DISTINCT FROM OLD.current_version
    OR NEW.total_amount IS DISTINCT FROM OLD.total_amount
    OR NEW.accepted_version IS DISTINCT FROM OLD.accepted_version
    OR NEW.accepted_amount IS DISTINCT FROM OLD.accepted_amount
    OR NEW.accepted_at IS DISTINCT FROM OLD.accepted_at
  ) THEN
    RAISE EXCEPTION 'Proposta aceita e imutavel' USING ERRCODE = '22023';
  END IF;
  IF NEW.status = 'accepted' AND (
    NEW.accepted_version IS DISTINCT FROM NEW.current_version
    OR NEW.accepted_amount IS DISTINCT FROM NEW.total_amount
    OR NEW.accepted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Aceite sem snapshot comercial valido' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gsa_ads_proposal_transition ON public.gsa_ad_proposals;
CREATE TRIGGER trg_gsa_ads_proposal_transition
BEFORE UPDATE ON public.gsa_ad_proposals
FOR EACH ROW EXECUTE FUNCTION public.gsa_ads_guard_proposal_transition();

CREATE OR REPLACE FUNCTION public.gsa_ads_guard_proposal_version_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'Versoes comerciais sao imutaveis' USING ERRCODE = '22023';
END;
$$;

DROP TRIGGER IF EXISTS trg_gsa_ads_proposal_version_immutable ON public.gsa_ad_proposal_versions;
CREATE TRIGGER trg_gsa_ads_proposal_version_immutable
BEFORE UPDATE OR DELETE ON public.gsa_ad_proposal_versions
FOR EACH ROW EXECUTE FUNCTION public.gsa_ads_guard_proposal_version_immutable();

CREATE OR REPLACE FUNCTION public.gsa_ads_guard_payment_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.gsa_ads_payment_transition_allowed(OLD.status, NEW.status) THEN
    RAISE EXCEPTION 'Transicao financeira invalida: % -> %', OLD.status, NEW.status USING ERRCODE = '22023';
  END IF;
  IF NEW.amount IS DISTINCT FROM OLD.amount
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.campaign_id IS DISTINCT FROM OLD.campaign_id
     OR NEW.proposal_id IS DISTINCT FROM OLD.proposal_id THEN
    RAISE EXCEPTION 'Contrato financeiro imutavel' USING ERRCODE = '22023';
  END IF;
  IF NEW.provider_reference IS DISTINCT FROM OLD.provider_reference
     AND EXISTS (SELECT 1 FROM public.gsa_ad_payment_events e WHERE e.payment_id = OLD.id) THEN
    RAISE EXCEPTION 'Referencia com eventos financeiros e imutavel' USING ERRCODE = '22023';
  END IF;
  IF NEW.status = 'paid' THEN
    NEW.paid_at := COALESCE(OLD.paid_at, NEW.paid_at, now());
  ELSIF OLD.paid_at IS NOT NULL AND NEW.paid_at IS NULL THEN
    RAISE EXCEPTION 'Data historica de pagamento nao pode ser apagada' USING ERRCODE = '22023';
  END IF;
  IF NEW.status = 'overdue' THEN
    NEW.overdue_at := COALESCE(OLD.overdue_at, NEW.overdue_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gsa_ads_payment_transition ON public.gsa_ad_payments;
CREATE TRIGGER trg_gsa_ads_payment_transition
BEFORE UPDATE ON public.gsa_ad_payments
FOR EACH ROW EXECUTE FUNCTION public.gsa_ads_guard_payment_transition();

CREATE OR REPLACE FUNCTION public.gsa_ads_guard_campaign_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_allowed boolean := false;
BEGIN
  IF OLD.status = NEW.status THEN
    v_allowed := true;
  ELSE
    v_allowed := CASE OLD.status
      WHEN 'draft' THEN NEW.status IN ('payment_pending','payment_overdue','creative_review','scheduled','active','cancelled','completed')
      WHEN 'payment_pending' THEN NEW.status IN ('payment_overdue','creative_review','scheduled','active','paused','cancelled','completed')
      WHEN 'payment_overdue' THEN NEW.status IN ('payment_pending','creative_review','scheduled','active','paused','cancelled','completed')
      WHEN 'creative_review' THEN NEW.status IN ('payment_pending','payment_overdue','scheduled','active','paused','cancelled','completed')
      WHEN 'scheduled' THEN NEW.status IN ('payment_pending','payment_overdue','creative_review','active','paused','cancelled','completed')
      WHEN 'active' THEN NEW.status IN ('payment_pending','payment_overdue','creative_review','paused','cancelled','completed')
      WHEN 'paused' THEN NEW.status IN ('payment_pending','payment_overdue','creative_review','scheduled','active','cancelled','completed')
      ELSE false
    END;
  END IF;
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Transicao de campanha invalida: % -> %', OLD.status, NEW.status USING ERRCODE = '22023';
  END IF;
  IF OLD.status <> 'draft' AND (
    NEW.advertiser_id IS DISTINCT FROM OLD.advertiser_id
    OR NEW.proposal_id IS DISTINCT FROM OLD.proposal_id
    OR NEW.starts_at IS DISTINCT FROM OLD.starts_at
    OR NEW.ends_at IS DISTINCT FROM OLD.ends_at
    OR NEW.devices IS DISTINCT FROM OLD.devices
    OR NEW.frequency_model IS DISTINCT FROM OLD.frequency_model
    OR NEW.frequency_value IS DISTINCT FROM OLD.frequency_value
    OR NEW.impression_limit IS DISTINCT FROM OLD.impression_limit
  ) THEN
    RAISE EXCEPTION 'Segmentacao contratada da campanha e imutavel' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gsa_ads_campaign_transition ON public.gsa_ad_campaigns;
CREATE TRIGGER trg_gsa_ads_campaign_transition
BEFORE UPDATE ON public.gsa_ad_campaigns
FOR EACH ROW EXECUTE FUNCTION public.gsa_ads_guard_campaign_transition();

CREATE OR REPLACE FUNCTION public.gsa_ads_guard_creative_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.status IN ('pending_review','approved') AND (
    NEW.campaign_id IS DISTINCT FROM OLD.campaign_id
    OR NEW.kind IS DISTINCT FROM OLD.kind
    OR NEW.storage_path IS DISTINCT FROM OLD.storage_path
    OR NEW.target_url IS DISTINCT FROM OLD.target_url
    OR NEW.headline IS DISTINCT FROM OLD.headline
    OR NEW.body IS DISTINCT FROM OLD.body
    OR NEW.alt_text IS DISTINCT FROM OLD.alt_text
    OR NEW.width IS DISTINCT FROM OLD.width
    OR NEW.height IS DISTINCT FROM OLD.height
    OR NEW.duration_seconds IS DISTINCT FROM OLD.duration_seconds
    OR NEW.metadata IS DISTINCT FROM OLD.metadata
  ) THEN
    RAISE EXCEPTION 'Conteudo enviado para revisao e imutavel' USING ERRCODE = '22023';
  END IF;
  IF OLD.status = 'approved' AND NEW.status NOT IN ('approved','archived') THEN
    RAISE EXCEPTION 'Criativo aprovado deve ser arquivado antes da remocao' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gsa_ads_creative_immutable ON public.gsa_ad_creatives;
CREATE TRIGGER trg_gsa_ads_creative_immutable
BEFORE UPDATE ON public.gsa_ad_creatives
FOR EACH ROW EXECUTE FUNCTION public.gsa_ads_guard_creative_immutable();

CREATE OR REPLACE FUNCTION public.gsa_ads_consume_rate_limit(
  p_scope_hash text,
  p_action text,
  p_limit integer,
  p_window_seconds integer DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_bucket timestamptz;
  v_count integer;
BEGIN
  IF p_scope_hash !~ '^[a-f0-9]{64}$'
     OR p_action !~ '^[a-z0-9_]{1,40}$'
     OR p_limit NOT BETWEEN 1 AND 10000
     OR p_window_seconds NOT BETWEEN 10 AND 86400 THEN
    RETURN false;
  END IF;
  v_bucket := to_timestamp(
    floor(extract(epoch FROM clock_timestamp()) / p_window_seconds) * p_window_seconds
  );
  INSERT INTO public.gsa_ad_rate_limit_buckets(scope_hash, action, bucket_start, hit_count, updated_at)
  VALUES (p_scope_hash, p_action, v_bucket, 1, now())
  ON CONFLICT (scope_hash, action, bucket_start) DO UPDATE
    SET hit_count = public.gsa_ad_rate_limit_buckets.hit_count + 1,
        updated_at = now()
  RETURNING hit_count INTO v_count;
  RETURN v_count <= p_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_ads_validate_creative_object(
  p_advertiser_id uuid,
  p_campaign_id uuid,
  p_kind text,
  p_storage_path text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage, pg_temp
AS $$
DECLARE
  v_object jsonb;
  v_metadata jsonb;
  v_mime text;
  v_size bigint;
BEGIN
  IF p_kind = 'text' THEN RETURN p_storage_path IS NULL; END IF;
  IF p_kind NOT IN ('image','video') OR p_storage_path IS NULL THEN RETURN false; END IF;
  IF length(p_storage_path) > 500
     OR p_storage_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[A-Za-z0-9][A-Za-z0-9._-]{0,180}$'
     OR split_part(p_storage_path, '/', 1) <> p_advertiser_id::text
     OR split_part(p_storage_path, '/', 2) <> p_campaign_id::text THEN
    RETURN false;
  END IF;

  SELECT to_jsonb(o) INTO v_object
    FROM storage.objects o
   WHERE o.bucket_id = 'gsa-ad-creatives'
     AND o.name = p_storage_path
   FOR SHARE;
  IF v_object IS NULL THEN RETURN false; END IF;

  -- to_jsonb keeps this routine compatible with the reduced storage.objects
  -- relation used by local CI while validating MIME and size in Supabase.
  v_metadata := v_object->'metadata';
  IF v_metadata IS NOT NULL AND jsonb_typeof(v_metadata) = 'object' THEN
    v_mime := lower(COALESCE(v_metadata->>'mimetype', v_metadata->>'contentType', ''));
    IF COALESCE(v_metadata->>'size', '') ~ '^[0-9]+$' THEN
      v_size := (v_metadata->>'size')::bigint;
    END IF;
    IF v_size IS NOT NULL AND (v_size <= 0 OR v_size > 52428800) THEN RETURN false; END IF;
    IF v_mime <> '' AND p_kind = 'image' AND v_mime NOT IN ('image/jpeg','image/png','image/webp','image/gif') THEN RETURN false; END IF;
    IF v_mime <> '' AND p_kind = 'video' AND v_mime NOT IN ('video/mp4','video/webm') THEN RETURN false; END IF;
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_ads_assert_inventory(
  p_campaign_id uuid,
  p_placement_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_share_percent numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_placement public.gsa_ad_placements;
  v_count integer;
  v_share numeric;
BEGIN
  IF p_starts_at IS NULL OR p_ends_at IS NULL OR p_ends_at <= p_starts_at
     OR p_share_percent <= 0 OR p_share_percent > 100 THEN
    RAISE EXCEPTION 'Reserva de inventario invalida' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('gsa_ads_inventory:' || p_placement_id::text, 0));
  SELECT * INTO v_placement
    FROM public.gsa_ad_placements
   WHERE id = p_placement_id
   FOR UPDATE;
  IF v_placement.id IS NULL OR NOT v_placement.active THEN
    RAISE EXCEPTION 'Posicao publicitaria indisponivel' USING ERRCODE = '22023';
  END IF;

  SELECT count(DISTINCT c.id), COALESCE(sum(cp.share_percent), 0)
    INTO v_count, v_share
    FROM public.gsa_ad_campaign_placements cp
    JOIN public.gsa_ad_campaigns c ON c.id = cp.campaign_id
   WHERE cp.placement_id = p_placement_id
     AND (p_campaign_id IS NULL OR c.id <> p_campaign_id)
     AND c.status NOT IN ('completed','cancelled')
     AND COALESCE(c.starts_at, '-infinity'::timestamptz) < p_ends_at
     AND COALESCE(c.ends_at, 'infinity'::timestamptz) > p_starts_at;

  IF v_placement.exclusive AND v_count > 0 THEN
    RAISE EXCEPTION 'Posicao exclusiva ja reservada no periodo' USING ERRCODE = 'P0001';
  END IF;
  IF v_count >= v_placement.capacity THEN
    RAISE EXCEPTION 'Capacidade da posicao esgotada no periodo' USING ERRCODE = 'P0001';
  END IF;
  IF v_share + p_share_percent > 100.0001 THEN
    RAISE EXCEPTION 'Percentual de rotacao excede 100%% no periodo' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_ads_sync_campaign_state(
  p_campaign_id uuid,
  p_resume boolean DEFAULT false
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_campaign public.gsa_ad_campaigns;
  v_payment public.gsa_ad_payments;
  v_target text;
BEGIN
  SELECT * INTO v_campaign FROM public.gsa_ad_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF v_campaign.id IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO v_payment FROM public.gsa_ad_payments WHERE campaign_id = p_campaign_id;

  IF v_campaign.status = 'cancelled' THEN RETURN v_campaign.status; END IF;
  IF v_campaign.ends_at IS NOT NULL AND v_campaign.ends_at <= now() THEN
    v_target := 'completed';
  ELSIF v_payment.id IS NOT NULL AND v_payment.status IN ('refunded','cancelled') THEN
    v_target := 'cancelled';
  ELSIF v_campaign.status = 'completed' THEN
    RETURN v_campaign.status;
  ELSIF v_campaign.status = 'paused' AND NOT p_resume THEN
    RETURN v_campaign.status;
  ELSIF v_payment.id IS NULL OR v_payment.status <> 'paid' OR v_campaign.paid_at IS NULL THEN
    IF v_payment.id IS NOT NULL
       AND (v_payment.status = 'overdue' OR (v_payment.due_at IS NOT NULL AND v_payment.due_at <= now())) THEN
      v_target := 'payment_overdue';
    ELSE
      v_target := 'payment_pending';
    END IF;
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.gsa_ad_creatives cr
     WHERE cr.campaign_id = p_campaign_id
       AND cr.status = 'approved'
       AND (
         (cr.kind = 'text' AND COALESCE(NULLIF(trim(cr.headline), ''), NULLIF(trim(cr.body), '')) IS NOT NULL)
         OR (cr.kind IN ('image','video') AND public.gsa_ads_validate_creative_object(v_campaign.advertiser_id, v_campaign.id, cr.kind, cr.storage_path))
       )
  ) THEN
    v_target := 'creative_review';
  ELSIF v_campaign.starts_at IS NOT NULL AND v_campaign.starts_at > now() THEN
    v_target := 'scheduled';
  ELSE
    v_target := 'active';
  END IF;

  UPDATE public.gsa_ad_campaigns
     SET status = v_target,
         activated_at = CASE WHEN v_target = 'active' THEN COALESCE(activated_at, now()) ELSE activated_at END,
         resumed_at = CASE WHEN p_resume THEN now() ELSE resumed_at END,
         paused_at = CASE WHEN p_resume THEN NULL ELSE paused_at END,
         completed_at = CASE WHEN v_target = 'completed' THEN COALESCE(completed_at, now()) ELSE completed_at END,
         cancelled_at = CASE WHEN v_target = 'cancelled' THEN COALESCE(cancelled_at, now()) ELSE cancelled_at END
   WHERE id = p_campaign_id;
  RETURN v_target;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_ads_apply_payment_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'paid' THEN
    UPDATE public.gsa_ad_campaigns
       SET paid_at = COALESCE(paid_at, NEW.paid_at, now())
     WHERE id = NEW.campaign_id;
  ELSIF NEW.status IN ('refunded','cancelled') THEN
    UPDATE public.gsa_ad_campaigns SET paid_at = NULL WHERE id = NEW.campaign_id;
  END IF;
  PERFORM public.gsa_ads_sync_campaign_state(NEW.campaign_id, false);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gsa_ads_apply_payment_state ON public.gsa_ad_payments;
CREATE TRIGGER trg_gsa_ads_apply_payment_state
AFTER INSERT OR UPDATE OF status, due_at, paid_at ON public.gsa_ad_payments
FOR EACH ROW EXECUTE FUNCTION public.gsa_ads_apply_payment_state();

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
  v_document text;
  v_budget numeric(12,2);
  v_start date;
  v_end date;
  v_source jsonb;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' OR pg_column_size(p_payload) > 32768 THEN
    RAISE EXCEPTION 'Solicitacao invalida' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(trim(p_payload->>'website_confirmation'), '') <> '' THEN
    RAISE EXCEPTION 'Solicitacao invalida' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(COALESCE(p_payload->'desired_formats', 'null'::jsonb)) <> 'array'
     OR jsonb_typeof(COALESCE(p_payload->'desired_pages', 'null'::jsonb)) <> 'array'
     OR jsonb_typeof(COALESCE(p_payload->'devices', 'null'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Listas da solicitacao invalidas' USING ERRCODE = '22023';
  END IF;

  BEGIN
    v_budget := (p_payload->>'intended_budget')::numeric;
    v_start := nullif(p_payload->>'desired_start_date', '')::date;
    v_end := nullif(p_payload->>'desired_end_date', '')::date;
  EXCEPTION WHEN invalid_text_representation OR datetime_field_overflow OR numeric_value_out_of_range THEN
    RAISE EXCEPTION 'Datas ou valor invalidos' USING ERRCODE = '22023';
  END;

  v_document := regexp_replace(COALESCE(p_payload->>'document', ''), '[^0-9]', '', 'g');
  v_source := COALESCE(p_payload->'source_metadata', '{}'::jsonb);
  IF jsonb_typeof(v_source) <> 'object' OR pg_column_size(v_source) > 4096 THEN
    RAISE EXCEPTION 'Metadados invalidos' USING ERRCODE = '22023';
  END IF;
  IF length(trim(COALESCE(p_payload->>'company_name',''))) NOT BETWEEN 2 AND 180
     OR NOT public.gsa_ads_valid_cpf_cnpj(v_document)
     OR COALESCE(p_payload->>'company_size','') NOT IN ('autonomo','mei','micro','pequena','media','grande')
     OR length(trim(COALESCE(p_payload->>'segment',''))) NOT BETWEEN 2 AND 120
     OR length(trim(COALESCE(p_payload->>'contact_name',''))) NOT BETWEEN 2 AND 160
     OR length(COALESCE(p_payload->>'contact_email','')) > 254
     OR COALESCE(p_payload->>'contact_email','') !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     OR length(regexp_replace(COALESCE(p_payload->>'contact_phone',''), '[^0-9]', '', 'g')) NOT BETWEEN 10 AND 15
     OR length(trim(COALESCE(p_payload->>'objective',''))) NOT BETWEEN 3 AND 1000
     OR length(COALESCE(p_payload->>'notes','')) > 2000
     OR v_budget IS NULL OR v_budget <= 0 OR v_budget > 100000000
     OR (nullif(trim(COALESCE(p_payload->>'website','')), '') IS NOT NULL
         AND (length(p_payload->>'website') > 300 OR p_payload->>'website' !~ '^https://'))
     OR (v_start IS NOT NULL AND v_start < current_date)
     OR (v_end IS NOT NULL AND v_start IS NULL)
     OR (v_end IS NOT NULL AND v_end < v_start)
     OR (v_end IS NOT NULL AND v_end > v_start + 366) THEN
    RAISE EXCEPTION 'Dados da solicitacao invalidos' USING ERRCODE = '22023';
  END IF;

  SELECT array_agg(value ORDER BY ordinality) INTO v_formats
    FROM jsonb_array_elements_text(p_payload->'desired_formats') WITH ORDINALITY AS x(value, ordinality);
  SELECT array_agg(value ORDER BY ordinality) INTO v_pages
    FROM jsonb_array_elements_text(p_payload->'desired_pages') WITH ORDINALITY AS x(value, ordinality);
  SELECT array_agg(value ORDER BY ordinality) INTO v_devices
    FROM jsonb_array_elements_text(p_payload->'devices') WITH ORDINALITY AS x(value, ordinality);

  IF cardinality(v_formats) NOT BETWEEN 1 AND 11
     OR cardinality(v_pages) NOT BETWEEN 1 AND 20
     OR cardinality(v_devices) NOT BETWEEN 1 AND 3
     OR (SELECT count(DISTINCT x) FROM unnest(v_formats) x) <> cardinality(v_formats)
     OR (SELECT count(DISTINCT x) FROM unnest(v_pages) x) <> cardinality(v_pages)
     OR (SELECT count(DISTINCT x) FROM unnest(v_devices) x) <> cardinality(v_devices)
     OR EXISTS (SELECT 1 FROM unnest(v_formats) x WHERE x NOT IN (
       'responsive_banner','sponsored_card','rectangle','sticky_banner','hero','inline_video',
       'floating_video','lightbox','section_sponsorship','sponsored_content','takeover'
     ))
     OR EXISTS (SELECT 1 FROM unnest(v_devices) x WHERE x NOT IN ('desktop','tablet','mobile'))
     OR (SELECT count(*) FROM public.gsa_ad_placements p WHERE p.active AND p.code = ANY(v_pages)) <> cardinality(v_pages) THEN
    RAISE EXCEPTION 'Formatos, posicoes ou dispositivos invalidos' USING ERRCODE = '22023';
  END IF;

  v_protocol := 'ADS-' || to_char(current_date, 'YYYYMMDD') || '-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 12));
  INSERT INTO public.gsa_ad_requests (
    protocol, company_name, document, company_size, segment, contact_name, contact_email,
    contact_phone, website, objective, desired_formats, desired_pages, devices,
    desired_start_date, desired_end_date, intended_budget, needs_creative_service, notes, source_metadata
  ) VALUES (
    v_protocol, trim(p_payload->>'company_name'), v_document, p_payload->>'company_size',
    trim(p_payload->>'segment'), trim(p_payload->>'contact_name'), lower(trim(p_payload->>'contact_email')),
    regexp_replace(p_payload->>'contact_phone', '[^0-9]', '', 'g'), nullif(trim(p_payload->>'website'), ''),
    trim(p_payload->>'objective'), v_formats, v_pages, v_devices, v_start, v_end, v_budget,
    COALESCE((p_payload->>'needs_creative_service')::boolean, false), nullif(trim(p_payload->>'notes'), ''), v_source
  ) RETURNING id INTO v_request_id;

  FOREACH v_placement_code IN ARRAY v_pages LOOP
    INSERT INTO public.gsa_ad_request_placements(request_id, placement_id)
    SELECT v_request_id, id FROM public.gsa_ad_placements WHERE code = v_placement_code AND active;
  END LOOP;
  RETURN jsonb_build_object('success', true, 'request_id', v_request_id, 'protocol', v_protocol, 'status', 'submitted');
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
  v_proposal public.gsa_ad_proposals;
  v_version integer;
  v_amount numeric(12,2);
  v_starts date;
  v_ends date;
  v_duration integer;
  v_formats text[];
  v_placements text[];
  v_frequency text;
  v_frequency_value integer;
  v_impression_limit bigint;
  v_valid_until timestamptz;
  v_shares jsonb;
BEGIN
  IF NOT public.gsa_admin_has_module('anuncios') THEN
    RAISE EXCEPTION 'Acesso negado ao modulo de anuncios' USING ERRCODE = '42501';
  END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' OR pg_column_size(p_payload) > 32768 THEN
    RAISE EXCEPTION 'Proposta invalida' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_request FROM public.gsa_ad_requests WHERE id = p_request_id FOR UPDATE;
  IF v_request.id IS NULL THEN RAISE EXCEPTION 'Solicitacao nao encontrada' USING ERRCODE = 'P0002'; END IF;
  IF v_request.status IN ('accepted','rejected','cancelled') THEN
    RAISE EXCEPTION 'Solicitacao em estado comercial terminal' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.gsa_ad_proposals WHERE request_id = p_request_id AND status = 'accepted') THEN
    RAISE EXCEPTION 'Proposta aceita nao pode ser reaberta; crie uma nova solicitacao' USING ERRCODE = '22023';
  END IF;

  BEGIN
    v_amount := (p_payload->>'amount')::numeric;
    v_starts := COALESCE(nullif(p_payload->>'starts_on','')::date, v_request.desired_start_date, current_date + 7);
    v_ends := COALESCE(nullif(p_payload->>'ends_on','')::date, v_request.desired_end_date, v_starts + 29);
    v_frequency_value := nullif(p_payload->>'frequency_value','')::integer;
    v_impression_limit := nullif(p_payload->>'impression_limit','')::bigint;
    v_valid_until := COALESCE(nullif(p_payload->>'valid_until','')::timestamptz, now() + interval '7 days');
  EXCEPTION WHEN invalid_text_representation OR datetime_field_overflow OR numeric_value_out_of_range THEN
    RAISE EXCEPTION 'Valores da proposta invalidos' USING ERRCODE = '22023';
  END;
  v_frequency := COALESCE(nullif(p_payload->>'frequency_model',''), 'once_per_day');
  v_shares := COALESCE(p_payload->'placement_shares', '{}'::jsonb);
  IF v_amount IS NULL OR v_amount <= 0 OR v_amount > 100000000
     OR v_starts < current_date OR v_ends < v_starts OR v_ends > v_starts + 366
     OR v_valid_until <= now() OR v_valid_until > now() + interval '90 days'
     OR v_frequency NOT IN ('once_per_session','once_per_day','interval_hours','daily_limit','unlimited')
     OR (v_frequency IN ('interval_hours','daily_limit') AND COALESCE(v_frequency_value, 0) NOT BETWEEN 1 AND 1000)
     OR (v_frequency IN ('once_per_session','once_per_day','unlimited') AND v_frequency_value IS NOT NULL)
     OR (v_impression_limit IS NOT NULL AND v_impression_limit NOT BETWEEN 1 AND 1000000000)
     OR jsonb_typeof(v_shares) <> 'object'
     OR length(COALESCE(p_payload->>'terms','')) > 10000 THEN
    RAISE EXCEPTION 'Parametros comerciais invalidos' USING ERRCODE = '22023';
  END IF;
  v_duration := (v_ends - v_starts) + 1;

  IF p_payload ? 'formats' AND jsonb_typeof(p_payload->'formats') <> 'array' THEN
    RAISE EXCEPTION 'Formatos invalidos' USING ERRCODE = '22023';
  END IF;
  IF p_payload ? 'placement_codes' AND jsonb_typeof(p_payload->'placement_codes') <> 'array' THEN
    RAISE EXCEPTION 'Posicoes invalidas' USING ERRCODE = '22023';
  END IF;
  SELECT array_agg(value ORDER BY ordinality) INTO v_formats
    FROM jsonb_array_elements_text(COALESCE(p_payload->'formats', to_jsonb(v_request.desired_formats)))
         WITH ORDINALITY AS x(value, ordinality);
  SELECT array_agg(value ORDER BY ordinality) INTO v_placements
    FROM jsonb_array_elements_text(COALESCE(p_payload->'placement_codes', to_jsonb(v_request.desired_pages)))
         WITH ORDINALITY AS x(value, ordinality);
  IF cardinality(v_formats) NOT BETWEEN 1 AND 11 OR cardinality(v_placements) NOT BETWEEN 1 AND 20
     OR (SELECT count(DISTINCT x) FROM unnest(v_formats) x) <> cardinality(v_formats)
     OR (SELECT count(DISTINCT x) FROM unnest(v_placements) x) <> cardinality(v_placements)
     OR EXISTS (SELECT 1 FROM unnest(v_formats) x WHERE x NOT IN (
       'responsive_banner','sponsored_card','rectangle','sticky_banner','hero','inline_video',
       'floating_video','lightbox','section_sponsorship','sponsored_content','takeover'
     ))
     OR (SELECT count(*) FROM public.gsa_ad_placements p WHERE p.active AND p.code = ANY(v_placements)) <> cardinality(v_placements)
     OR EXISTS (
       SELECT 1 FROM jsonb_each(v_shares) s
        WHERE s.key <> ALL(v_placements)
           OR jsonb_typeof(s.value) <> 'number'
           OR (s.value #>> '{}')::numeric <= 0
           OR (s.value #>> '{}')::numeric > 100
     ) THEN
    RAISE EXCEPTION 'Formatos, posicoes ou percentuais invalidos' USING ERRCODE = '22023';
  END IF;

  SELECT id INTO v_advertiser_id
    FROM public.gsa_advertisers
   WHERE regexp_replace(document, '[^0-9]', '', 'g') = regexp_replace(v_request.document, '[^0-9]', '', 'g')
   LIMIT 1;
  IF v_advertiser_id IS NULL THEN
    INSERT INTO public.gsa_advertisers(
      legal_name, trade_name, document, company_size, segment, website,
      responsible_name, responsible_email, responsible_phone, status
    ) VALUES (
      v_request.company_name, v_request.company_name, v_request.document, v_request.company_size,
      v_request.segment, v_request.website, v_request.contact_name, lower(v_request.contact_email),
      v_request.contact_phone, 'pending_verification'
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

  SELECT * INTO v_proposal
    FROM public.gsa_ad_proposals
   WHERE request_id = p_request_id
   ORDER BY created_at DESC
   LIMIT 1
   FOR UPDATE;
  IF v_proposal.id IS NULL THEN
    v_version := 1;
    INSERT INTO public.gsa_ad_proposals(request_id,current_version,status,total_amount,valid_until,created_by)
    VALUES (p_request_id,v_version,'sent',v_amount,v_valid_until,public.gsa_current_actor_id())
    RETURNING * INTO v_proposal;
  ELSE
    IF v_proposal.status IN ('accepted','rejected','cancelled') THEN
      RAISE EXCEPTION 'Proposta terminal nao pode receber nova versao' USING ERRCODE = '22023';
    END IF;
    v_version := v_proposal.current_version + 1;
    UPDATE public.gsa_ad_proposals
       SET current_version = v_version,
           status = 'sent',
           total_amount = v_amount,
           valid_until = v_valid_until,
           accepted_at = NULL,
           accepted_version = NULL,
           accepted_amount = NULL
     WHERE id = v_proposal.id
     RETURNING * INTO v_proposal;
  END IF;

  INSERT INTO public.gsa_ad_proposal_versions(
    proposal_id,version,amount,duration_days,starts_on,ends_on,formats,placement_codes,
    placement_shares,frequency_model,frequency_value,impression_limit,terms,created_by_type,created_by
  ) VALUES (
    v_proposal.id,v_version,v_amount,v_duration,v_starts,v_ends,v_formats,v_placements,
    v_shares,v_frequency,v_frequency_value,v_impression_limit,nullif(trim(p_payload->>'terms'),''),
    'admin',public.gsa_current_actor_id()
  );
  UPDATE public.gsa_ad_requests SET status = 'proposal_sent' WHERE id = p_request_id;
  INSERT INTO public.gsa_ad_audit_logs(actor_type,actor_id,action,entity_type,entity_id,details)
  VALUES (public.gsa_current_actor_type(),public.gsa_current_actor_id(),'CREATE_PROPOSAL_VERSION','ad_proposal',v_proposal.id,
    jsonb_build_object('version',v_version,'amount',v_amount,'placements',v_placements));
  RETURN jsonb_build_object('success',true,'advertiser_id',v_advertiser_id,'proposal_id',v_proposal.id,'version',v_version,'amount',v_amount);
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
  v_proposal public.gsa_ad_proposals;
BEGIN
  IF v_advertiser_id IS NULL OR p_amount IS NULL OR p_amount <= 0 OR p_amount > 100000000
     OR length(trim(COALESCE(p_message,''))) NOT BETWEEN 3 AND 2000 THEN
    RAISE EXCEPTION 'Contraproposta invalida' USING ERRCODE = '22023';
  END IF;
  SELECT p.* INTO v_proposal
    FROM public.gsa_ad_proposals p
    JOIN public.gsa_ad_requests r ON r.id = p.request_id
   WHERE p.id = p_proposal_id AND r.advertiser_id = v_advertiser_id
   FOR UPDATE OF p;
  IF v_proposal.id IS NULL OR v_proposal.status NOT IN ('sent','negotiating','final_offer') THEN
    RAISE EXCEPTION 'Proposta nao disponivel' USING ERRCODE = '42501';
  END IF;
  IF v_proposal.valid_until IS NOT NULL AND v_proposal.valid_until <= now() THEN
    UPDATE public.gsa_ad_proposals SET status = 'expired' WHERE id = p_proposal_id;
    RETURN jsonb_build_object('success',false,'error','proposal_expired','status','expired');
  END IF;
  INSERT INTO public.gsa_ad_negotiations(proposal_id,actor_type,actor_id,proposed_amount,message)
  VALUES (p_proposal_id,'advertiser',v_advertiser_id,p_amount,trim(p_message));
  UPDATE public.gsa_ad_proposals SET status = 'negotiating' WHERE id = p_proposal_id;
  UPDATE public.gsa_ad_requests SET status = 'negotiation_requested' WHERE id = v_proposal.request_id;
  RETURN jsonb_build_object('success',true,'status','negotiating');
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_advertiser_reject_proposal(p_proposal_id uuid, p_message text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_advertiser_id uuid := public.gsa_current_advertiser_id();
  v_proposal public.gsa_ad_proposals;
  v_message text := nullif(trim(COALESCE(p_message,'')), '');
BEGIN
  IF v_advertiser_id IS NULL OR length(COALESCE(v_message,'')) > 2000 THEN
    RAISE EXCEPTION 'Recusa invalida' USING ERRCODE = '22023';
  END IF;
  SELECT p.* INTO v_proposal
    FROM public.gsa_ad_proposals p
    JOIN public.gsa_ad_requests r ON r.id = p.request_id
   WHERE p.id = p_proposal_id AND r.advertiser_id = v_advertiser_id
   FOR UPDATE OF p;
  IF v_proposal.id IS NULL OR v_proposal.status NOT IN ('sent','negotiating','final_offer') THEN
    RAISE EXCEPTION 'Proposta nao disponivel' USING ERRCODE = '42501';
  END IF;
  IF v_proposal.valid_until IS NOT NULL AND v_proposal.valid_until <= now() THEN
    UPDATE public.gsa_ad_proposals SET status = 'expired' WHERE id = p_proposal_id;
    RETURN jsonb_build_object('success',false,'error','proposal_expired','status','expired');
  END IF;
  IF v_message IS NOT NULL THEN
    INSERT INTO public.gsa_ad_negotiations(proposal_id,actor_type,actor_id,message)
    VALUES (p_proposal_id,'advertiser',v_advertiser_id,v_message);
  END IF;
  UPDATE public.gsa_ad_proposals SET status = 'rejected' WHERE id = p_proposal_id;
  UPDATE public.gsa_ad_requests SET status = 'rejected' WHERE id = v_proposal.request_id;
  RETURN jsonb_build_object('success',true,'status','rejected');
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_update_ad_proposal_status(
  p_proposal_id uuid,
  p_status text,
  p_message text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_proposal public.gsa_ad_proposals;
  v_message text := nullif(trim(COALESCE(p_message,'')), '');
BEGIN
  IF NOT public.gsa_admin_has_module('anuncios') THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501'; END IF;
  IF p_status NOT IN ('final_offer','rejected','cancelled') OR length(COALESCE(v_message,'')) > 2000 THEN
    RAISE EXCEPTION 'Status de proposta invalido' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_proposal FROM public.gsa_ad_proposals WHERE id = p_proposal_id FOR UPDATE;
  IF v_proposal.id IS NULL THEN RAISE EXCEPTION 'Proposta nao encontrada' USING ERRCODE = 'P0002'; END IF;
  IF v_proposal.status = 'accepted' THEN RAISE EXCEPTION 'Proposta aceita e imutavel' USING ERRCODE = '22023'; END IF;
  IF v_proposal.valid_until IS NOT NULL AND v_proposal.valid_until <= now()
     AND v_proposal.status IN ('sent','negotiating','final_offer') THEN
    UPDATE public.gsa_ad_proposals SET status = 'expired' WHERE id = p_proposal_id;
    RETURN jsonb_build_object('success',false,'error','proposal_expired','status','expired');
  END IF;
  IF p_status = 'final_offer' AND v_proposal.status NOT IN ('sent','negotiating') THEN
    RAISE EXCEPTION 'Oferta final indisponivel neste estado' USING ERRCODE = '22023';
  END IF;
  IF p_status IN ('rejected','cancelled') AND v_proposal.status NOT IN ('draft','sent','negotiating','final_offer','expired') THEN
    RAISE EXCEPTION 'Encerramento indisponivel neste estado' USING ERRCODE = '22023';
  END IF;
  IF v_message IS NOT NULL THEN
    INSERT INTO public.gsa_ad_negotiations(proposal_id,actor_type,actor_id,message)
    VALUES (p_proposal_id,'admin',public.gsa_current_actor_id(),v_message);
  END IF;
  UPDATE public.gsa_ad_proposals SET status = p_status WHERE id = p_proposal_id;
  UPDATE public.gsa_ad_requests
     SET status = CASE p_status WHEN 'final_offer' THEN 'proposal_sent' WHEN 'rejected' THEN 'rejected' ELSE 'cancelled' END
   WHERE id = v_proposal.request_id;
  INSERT INTO public.gsa_ad_audit_logs(actor_type,actor_id,action,entity_type,entity_id,details)
  VALUES (public.gsa_current_actor_type(),public.gsa_current_actor_id(),'UPDATE_PROPOSAL_STATUS','ad_proposal',p_proposal_id,
    jsonb_build_object('from',v_proposal.status,'to',p_status,'has_message',v_message IS NOT NULL));
  RETURN jsonb_build_object('success',true,'proposal_id',p_proposal_id,'status',p_status);
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
  v_reference text;
  v_placement record;
  v_share numeric;
BEGIN
  IF v_advertiser_id IS NULL THEN RAISE EXCEPTION 'Conta de anunciante indisponivel' USING ERRCODE = '42501'; END IF;
  SELECT p.* INTO v_proposal
    FROM public.gsa_ad_proposals p
    JOIN public.gsa_ad_requests r ON r.id = p.request_id
   WHERE p.id = p_proposal_id AND r.advertiser_id = v_advertiser_id
   FOR UPDATE OF p;
  IF v_proposal.id IS NULL OR v_proposal.status NOT IN ('sent','negotiating','final_offer') THEN
    RAISE EXCEPTION 'Proposta nao disponivel' USING ERRCODE = '42501';
  END IF;
  IF v_proposal.valid_until IS NOT NULL AND v_proposal.valid_until <= now() THEN
    UPDATE public.gsa_ad_proposals SET status = 'expired' WHERE id = p_proposal_id;
    RETURN jsonb_build_object('success',false,'error','proposal_expired','status','expired');
  END IF;
  IF EXISTS (SELECT 1 FROM public.gsa_ad_campaigns WHERE proposal_id = p_proposal_id) THEN
    RAISE EXCEPTION 'Proposta ja possui campanha e nao pode ser reaceita' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_version FROM public.gsa_ad_proposal_versions
   WHERE proposal_id = p_proposal_id AND version = v_proposal.current_version;
  SELECT * INTO v_request FROM public.gsa_ad_requests WHERE id = v_proposal.request_id FOR UPDATE;
  IF v_version.id IS NULL OR v_version.created_by_type <> 'admin'
     OR v_version.amount IS DISTINCT FROM v_proposal.total_amount
     OR v_version.ends_on < current_date
     OR cardinality(v_version.placement_codes) < 1
     OR cardinality(v_request.devices) < 1
     OR EXISTS (SELECT 1 FROM unnest(v_request.devices) d WHERE d NOT IN ('desktop','tablet','mobile')) THEN
    RAISE EXCEPTION 'Versao comercial inconsistente' USING ERRCODE = '22023';
  END IF;

  FOR v_placement IN
    SELECT p.* FROM public.gsa_ad_placements p
     WHERE p.code = ANY(v_version.placement_codes) AND p.active
     ORDER BY p.id
  LOOP
    BEGIN
      v_share := COALESCE(
        nullif(v_version.placement_shares->>v_placement.code, '')::numeric,
        round(100.0 / v_placement.capacity, 2)
      );
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'Percentual de inventario invalido' USING ERRCODE = '22023';
    END;
    PERFORM public.gsa_ads_assert_inventory(
      NULL, v_placement.id, v_version.starts_on::timestamptz,
      (v_version.ends_on + 1)::timestamptz, v_share
    );
  END LOOP;
  IF (SELECT count(*) FROM public.gsa_ad_placements p WHERE p.active AND p.code = ANY(v_version.placement_codes))
     <> cardinality(v_version.placement_codes) THEN
    RAISE EXCEPTION 'Uma ou mais posicoes deixaram de estar disponiveis' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.gsa_ad_campaigns(
    advertiser_id,proposal_id,name,slug,status,starts_at,ends_at,devices,
    frequency_model,frequency_value,impression_limit
  ) VALUES (
    v_advertiser_id,p_proposal_id,
    v_request.company_name || ' - ' || to_char(v_version.starts_on,'DD/MM/YYYY'),
    lower(trim(both '-' from regexp_replace(v_request.company_name,'[^a-zA-Z0-9]+','-','g')))
      || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,8),
    'payment_pending',v_version.starts_on::timestamptz,(v_version.ends_on + 1)::timestamptz,
    v_request.devices,v_version.frequency_model,v_version.frequency_value,v_version.impression_limit
  ) RETURNING id INTO v_campaign_id;

  FOR v_placement IN
    SELECT p.* FROM public.gsa_ad_placements p WHERE p.code = ANY(v_version.placement_codes) ORDER BY p.id
  LOOP
    v_share := COALESCE(
      nullif(v_version.placement_shares->>v_placement.code, '')::numeric,
      round(100.0 / v_placement.capacity, 2)
    );
    INSERT INTO public.gsa_ad_campaign_placements(campaign_id,placement_id,priority,share_percent)
    VALUES (v_campaign_id,v_placement.id,100,v_share);
  END LOOP;

  v_reference := 'ADS-' || upper(replace(gen_random_uuid()::text, '-', ''));
  INSERT INTO public.gsa_ad_payments(
    campaign_id,proposal_id,provider,provider_reference,amount,currency,status,due_at
  ) VALUES (
    v_campaign_id,p_proposal_id,'manual',v_reference,v_version.amount,'BRL','pending',now() + interval '3 days'
  ) RETURNING id INTO v_payment_id;

  UPDATE public.gsa_ad_proposals
     SET status = 'accepted', accepted_at = now(), accepted_version = current_version, accepted_amount = total_amount
   WHERE id = p_proposal_id;
  UPDATE public.gsa_ad_requests SET status = 'accepted' WHERE id = v_proposal.request_id;
  INSERT INTO public.gsa_ad_audit_logs(actor_type,actor_id,action,entity_type,entity_id,details)
  VALUES ('advertiser',v_advertiser_id,'ACCEPT_PROPOSAL','ad_proposal',p_proposal_id,
    jsonb_build_object('version',v_proposal.current_version,'campaign_id',v_campaign_id,'payment_id',v_payment_id));
  RETURN jsonb_build_object(
    'success',true,'campaign_id',v_campaign_id,'payment_id',v_payment_id,
    'payment_reference',v_reference,'status','payment_pending'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_update_ad_placement(p_placement_id uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old public.gsa_ad_placements;
  v_active boolean;
  v_capacity integer;
  v_exclusive boolean;
  v_price numeric(12,2);
  v_devices text[];
  v_conflict boolean;
BEGIN
  IF NOT public.gsa_admin_has_module('anuncios') THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501'; END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' OR pg_column_size(p_payload) > 4096
     OR (p_payload - ARRAY['active','capacity','exclusive','base_daily_price','devices']) <> '{}'::jsonb THEN
    RAISE EXCEPTION 'Alteracao de inventario invalida' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('gsa_ads_inventory:' || p_placement_id::text, 0));
  SELECT * INTO v_old FROM public.gsa_ad_placements WHERE id = p_placement_id FOR UPDATE;
  IF v_old.id IS NULL THEN RAISE EXCEPTION 'Posicao nao encontrada' USING ERRCODE = 'P0002'; END IF;

  BEGIN
    v_active := CASE WHEN p_payload ? 'active' THEN (p_payload->>'active')::boolean ELSE v_old.active END;
    v_capacity := CASE WHEN p_payload ? 'capacity' THEN (p_payload->>'capacity')::integer ELSE v_old.capacity END;
    v_exclusive := CASE WHEN p_payload ? 'exclusive' THEN (p_payload->>'exclusive')::boolean ELSE v_old.exclusive END;
    v_price := CASE WHEN p_payload ? 'base_daily_price' THEN (p_payload->>'base_daily_price')::numeric ELSE v_old.base_daily_price END;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION 'Valores de inventario invalidos' USING ERRCODE = '22023';
  END;
  IF p_payload ? 'devices' THEN
    IF jsonb_typeof(p_payload->'devices') <> 'array' THEN RAISE EXCEPTION 'Dispositivos invalidos' USING ERRCODE = '22023'; END IF;
    SELECT array_agg(value ORDER BY ordinality) INTO v_devices
      FROM jsonb_array_elements_text(p_payload->'devices') WITH ORDINALITY AS x(value, ordinality);
  ELSE
    v_devices := v_old.devices;
  END IF;
  IF v_capacity NOT BETWEEN 1 AND 100 OR v_price < 0 OR v_price > 100000000
     OR (v_exclusive AND v_capacity <> 1)
     OR cardinality(v_devices) NOT BETWEEN 1 AND 3
     OR (SELECT count(DISTINCT x) FROM unnest(v_devices) x) <> cardinality(v_devices)
     OR EXISTS (SELECT 1 FROM unnest(v_devices) x WHERE x NOT IN ('desktop','tablet','mobile')) THEN
    RAISE EXCEPTION 'Configuracao de inventario invalida' USING ERRCODE = '22023';
  END IF;

  WITH reservations AS (
    SELECT c.id,c.starts_at,c.ends_at,c.devices,cp.share_percent
      FROM public.gsa_ad_campaign_placements cp
      JOIN public.gsa_ad_campaigns c ON c.id = cp.campaign_id
     WHERE cp.placement_id = p_placement_id
       AND c.status NOT IN ('completed','cancelled')
       AND COALESCE(c.ends_at,'infinity'::timestamptz) > now()
  )
  SELECT EXISTS (
    SELECT 1 FROM reservations anchor
     WHERE (SELECT count(*) FROM reservations x
             WHERE COALESCE(x.starts_at,'-infinity'::timestamptz) < COALESCE(anchor.ends_at,'infinity'::timestamptz)
               AND COALESCE(x.ends_at,'infinity'::timestamptz) > COALESCE(anchor.starts_at,'-infinity'::timestamptz)) > v_capacity
        OR (SELECT sum(x.share_percent) FROM reservations x
             WHERE COALESCE(x.starts_at,'-infinity'::timestamptz) < COALESCE(anchor.ends_at,'infinity'::timestamptz)
               AND COALESCE(x.ends_at,'infinity'::timestamptz) > COALESCE(anchor.starts_at,'-infinity'::timestamptz)) > 100.0001
        OR (v_exclusive AND (SELECT count(*) FROM reservations x
             WHERE COALESCE(x.starts_at,'-infinity'::timestamptz) < COALESCE(anchor.ends_at,'infinity'::timestamptz)
               AND COALESCE(x.ends_at,'infinity'::timestamptz) > COALESCE(anchor.starts_at,'-infinity'::timestamptz)) > 1)
        OR NOT (anchor.devices && v_devices)
  ) INTO v_conflict;
  IF v_conflict THEN
    RAISE EXCEPTION 'Configuracao conflita com reservas vigentes' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.gsa_ad_placements
     SET active = v_active, capacity = v_capacity, exclusive = v_exclusive,
         base_daily_price = v_price, devices = v_devices
   WHERE id = p_placement_id;
  INSERT INTO public.gsa_ad_audit_logs(actor_type,actor_id,action,entity_type,entity_id,details)
  VALUES (public.gsa_current_actor_type(),public.gsa_current_actor_id(),'UPDATE_AD_PLACEMENT','ad_placement',p_placement_id,
    jsonb_build_object('active',v_active,'capacity',v_capacity,'exclusive',v_exclusive,'base_daily_price',v_price,'devices',v_devices));
  RETURN jsonb_build_object('success',true,'placement_id',p_placement_id,'active',v_active,'capacity',v_capacity,'exclusive',v_exclusive);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_update_ad_campaign_status(p_campaign_id uuid, p_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_campaign public.gsa_ad_campaigns;
  v_result text;
BEGIN
  IF NOT public.gsa_admin_has_module('anuncios') THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501'; END IF;
  IF p_status NOT IN ('paused','active','cancelled') THEN RAISE EXCEPTION 'Acao de campanha invalida' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_campaign FROM public.gsa_ad_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF v_campaign.id IS NULL THEN RAISE EXCEPTION 'Campanha nao encontrada' USING ERRCODE = 'P0002'; END IF;
  IF v_campaign.status IN ('completed','cancelled') THEN RAISE EXCEPTION 'Campanha em estado terminal' USING ERRCODE = '22023'; END IF;

  IF p_status = 'paused' THEN
    IF v_campaign.status NOT IN ('payment_pending','payment_overdue','creative_review','scheduled','active') THEN
      RAISE EXCEPTION 'Campanha nao pode ser pausada' USING ERRCODE = '22023';
    END IF;
    UPDATE public.gsa_ad_campaigns SET status = 'paused', paused_at = now() WHERE id = p_campaign_id;
    v_result := 'paused';
  ELSIF p_status = 'cancelled' THEN
    UPDATE public.gsa_ad_campaigns SET status = 'cancelled', cancelled_at = now() WHERE id = p_campaign_id;
    UPDATE public.gsa_ad_payments
       SET status = 'cancelled'
     WHERE campaign_id = p_campaign_id AND status IN ('pending','processing','failed','overdue');
    v_result := 'cancelled';
  ELSE
    IF v_campaign.status <> 'paused' THEN RAISE EXCEPTION 'Somente campanha pausada pode ser retomada' USING ERRCODE = '22023'; END IF;
    v_result := public.gsa_ads_sync_campaign_state(p_campaign_id, true);
  END IF;
  INSERT INTO public.gsa_ad_audit_logs(actor_type,actor_id,action,entity_type,entity_id,details)
  VALUES (public.gsa_current_actor_type(),public.gsa_current_actor_id(),'UPDATE_CAMPAIGN_STATUS','ad_campaign',p_campaign_id,
    jsonb_build_object('from',v_campaign.status,'requested',p_status,'result',v_result));
  RETURN jsonb_build_object('success',true,'campaign_id',p_campaign_id,'status',v_result);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_configure_ad_payment(
  p_payment_id uuid,
  p_provider text,
  p_provider_reference text,
  p_checkout_url text,
  p_pix_code text,
  p_due_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payment public.gsa_ad_payments;
  v_provider text := lower(trim(COALESCE(p_provider,'')));
  v_reference text := trim(COALESCE(p_provider_reference,''));
  v_checkout text := nullif(trim(COALESCE(p_checkout_url,'')), '');
  v_pix text := nullif(trim(COALESCE(p_pix_code,'')), '');
  v_status text;
BEGIN
  IF NOT public.gsa_admin_has_module('anuncios') THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501'; END IF;
  IF v_provider !~ '^[a-z0-9][a-z0-9_-]{1,49}$'
     OR length(v_reference) NOT BETWEEN 4 AND 200
     OR v_reference !~ '^[A-Za-z0-9._:/-]+$'
     OR (v_checkout IS NOT NULL AND (length(v_checkout) > 2000 OR v_checkout !~ '^https://'))
     OR length(COALESCE(v_pix,'')) > 2000
     OR p_due_at IS NULL OR p_due_at <= now() OR p_due_at > now() + interval '365 days' THEN
    RAISE EXCEPTION 'Configuracao de cobranca invalida' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_payment FROM public.gsa_ad_payments WHERE id = p_payment_id FOR UPDATE;
  IF v_payment.id IS NULL THEN RAISE EXCEPTION 'Pagamento nao encontrado' USING ERRCODE = 'P0002'; END IF;
  IF v_payment.status IN ('paid','refunded','cancelled') THEN
    RAISE EXCEPTION 'Pagamento em estado terminal' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.gsa_ad_payment_events WHERE payment_id = p_payment_id)
     AND (v_payment.provider IS DISTINCT FROM v_provider OR v_payment.provider_reference IS DISTINCT FROM v_reference) THEN
    RAISE EXCEPTION 'Provedor com eventos e imutavel' USING ERRCODE = '22023';
  END IF;
  v_status := CASE WHEN v_payment.status IN ('failed','overdue') THEN 'processing' ELSE v_payment.status END;
  UPDATE public.gsa_ad_payments
     SET provider = v_provider, provider_reference = v_reference, checkout_url = v_checkout,
         pix_code = v_pix, due_at = p_due_at, status = v_status,
         overdue_at = CASE WHEN v_status <> 'overdue' THEN NULL ELSE overdue_at END
   WHERE id = p_payment_id;
  INSERT INTO public.gsa_ad_audit_logs(actor_type,actor_id,action,entity_type,entity_id,details)
  VALUES (public.gsa_current_actor_type(),public.gsa_current_actor_id(),'CONFIGURE_AD_PAYMENT','ad_payment',p_payment_id,
    jsonb_build_object('provider',v_provider,'reference',v_reference,'due_at',p_due_at,'has_checkout',v_checkout IS NOT NULL,'has_pix',v_pix IS NOT NULL));
  RETURN jsonb_build_object('success',true,'payment_id',p_payment_id,'status',v_status,'provider_reference',v_reference);
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
  v_payment public.gsa_ad_payments;
  v_reference text := nullif(trim(COALESCE(p_provider_reference,'')), '');
  v_method text := nullif(trim(COALESCE(p_payment_method,'')), '');
BEGIN
  IF NOT public.gsa_admin_has_module('anuncios') THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501'; END IF;
  IF p_status NOT IN ('pending','processing','paid','failed','overdue','refunded','cancelled')
     OR length(COALESCE(v_reference,'')) > 200 OR length(COALESCE(v_method,'')) > 80 THEN
    RAISE EXCEPTION 'Status financeiro invalido' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_payment FROM public.gsa_ad_payments WHERE id = p_payment_id FOR UPDATE;
  IF v_payment.id IS NULL THEN RAISE EXCEPTION 'Pagamento nao encontrado' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.gsa_ads_payment_transition_allowed(v_payment.status,p_status) THEN
    RETURN jsonb_build_object('success',true,'ignored',true,'payment_id',p_payment_id,'status',v_payment.status);
  END IF;
  IF v_reference IS NOT NULL AND v_reference !~ '^[A-Za-z0-9._:/-]{4,200}$' THEN
    RAISE EXCEPTION 'Referencia invalida' USING ERRCODE = '22023';
  END IF;
  UPDATE public.gsa_ad_payments
     SET status = p_status,
         provider_reference = COALESCE(v_reference,provider_reference),
         payment_method = COALESCE(v_method,payment_method),
         raw_payload = jsonb_build_object('source','manual_admin','status',p_status,'recorded_at',now()),
         last_provider_event_at = now()
   WHERE id = p_payment_id;
  INSERT INTO public.gsa_ad_audit_logs(actor_type,actor_id,action,entity_type,entity_id,details)
  VALUES (public.gsa_current_actor_type(),public.gsa_current_actor_id(),'MARK_AD_PAYMENT','ad_payment',p_payment_id,
    jsonb_build_object('from',v_payment.status,'to',p_status,'method',v_method));
  RETURN jsonb_build_object('success',true,'payment_id',p_payment_id,'status',p_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_ads_process_payment_event(
  p_provider text,
  p_event_id text,
  p_reference text,
  p_status text,
  p_amount numeric,
  p_currency text,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payment public.gsa_ad_payments;
  v_existing public.gsa_ad_payment_events;
  v_provider text := lower(trim(COALESCE(p_provider,'')));
  v_reference text := trim(COALESCE(p_reference,''));
  v_allowed boolean;
BEGIN
  IF v_provider !~ '^[a-z0-9][a-z0-9_-]{1,49}$'
     OR length(trim(COALESCE(p_event_id,''))) NOT BETWEEN 1 AND 200
     OR length(v_reference) NOT BETWEEN 4 AND 200
     OR p_status NOT IN ('pending','processing','paid','failed','overdue','refunded','cancelled')
     OR p_amount IS NULL OR p_amount <= 0
     OR upper(trim(COALESCE(p_currency,''))) <> 'BRL'
     OR p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' OR pg_column_size(p_payload) > 131072 THEN
    RAISE EXCEPTION 'Evento financeiro invalido' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_payment FROM public.gsa_ad_payments WHERE provider_reference = v_reference FOR UPDATE;
  IF v_payment.id IS NULL THEN RAISE EXCEPTION 'Referencia de pagamento nao encontrada' USING ERRCODE = 'P0002'; END IF;
  IF v_payment.provider <> v_provider THEN RAISE EXCEPTION 'Provedor nao corresponde a cobranca' USING ERRCODE = '22023'; END IF;
  IF v_payment.amount IS DISTINCT FROM p_amount OR v_payment.currency <> upper(trim(p_currency)) THEN
    RAISE EXCEPTION 'Valor ou moeda nao corresponde a cobranca' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_existing FROM public.gsa_ad_payment_events
   WHERE provider = v_provider AND provider_event_id = trim(p_event_id);
  IF v_existing.id IS NOT NULL THEN
    RETURN jsonb_build_object('success',true,'duplicate',true,'status',v_payment.status);
  END IF;
  INSERT INTO public.gsa_ad_payment_events(payment_id,provider,provider_event_id,status,payload)
  VALUES (v_payment.id,v_provider,trim(p_event_id),p_status,p_payload);

  v_allowed := public.gsa_ads_payment_transition_allowed(v_payment.status,p_status);
  IF (v_payment.status IN ('failed','overdue') AND p_status = 'processing')
     OR (v_payment.status IN ('paid','refunded','cancelled') AND p_status <> v_payment.status AND NOT (v_payment.status = 'paid' AND p_status = 'refunded')) THEN
    v_allowed := false;
  END IF;
  IF NOT v_allowed THEN
    UPDATE public.gsa_ad_payments
       SET last_provider_event_at = now(),
           raw_payload = jsonb_build_object('provider',v_provider,'event_id',trim(p_event_id),'ignored_status',p_status,'received_at',now())
     WHERE id = v_payment.id;
    RETURN jsonb_build_object('success',true,'ignored',true,'payment_id',v_payment.id,'status',v_payment.status);
  END IF;

  UPDATE public.gsa_ad_payments
     SET status = p_status,
         last_provider_event_at = now(),
         raw_payload = jsonb_build_object('provider',v_provider,'event_id',trim(p_event_id),'status',p_status,'received_at',now())
   WHERE id = v_payment.id;
  RETURN jsonb_build_object('success',true,'payment_id',v_payment.id,'status',p_status);
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
  v_amount numeric;
  v_currency text;
BEGIN
  BEGIN
    v_amount := nullif(p_payload->>'amount','')::numeric;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION 'Valor do evento invalido' USING ERRCODE = '22023';
  END;
  v_currency := p_payload->>'currency';
  RETURN public.gsa_ads_process_payment_event(
    p_provider,p_event_id,p_reference,p_status,v_amount,v_currency,p_payload
  );
END;
$$;
