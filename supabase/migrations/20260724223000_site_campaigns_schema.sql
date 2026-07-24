BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.gsa_site_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_name text NOT NULL,
  title text NOT NULL,
  subtitle text,
  body text,
  category text NOT NULL DEFAULT 'announcement',
  format text NOT NULL DEFAULT 'popup',
  template text NOT NULL DEFAULT 'institutional_light',
  status text NOT NULL DEFAULT 'draft',
  priority integer NOT NULL DEFAULT 50,
  cta_label text,
  cta_url text,
  cta_target text NOT NULL DEFAULT '_self',
  secondary_cta_label text,
  secondary_cta_url text,
  image_desktop_url text,
  image_mobile_url text,
  image_alt text,
  target_pages text[] NOT NULL DEFAULT ARRAY['*']::text[],
  audience text NOT NULL DEFAULT 'all',
  devices text[] NOT NULL DEFAULT ARRAY['desktop','tablet','mobile']::text[],
  starts_at timestamptz,
  ends_at timestamptz,
  frequency_model text NOT NULL DEFAULT 'once_per_session',
  frequency_value integer,
  dismissible boolean NOT NULL DEFAULT true,
  dismiss_on_backdrop boolean NOT NULL DEFAULT true,
  dismiss_on_escape boolean NOT NULL DEFAULT true,
  auto_close_seconds integer,
  created_by_type text,
  created_by_id text,
  created_by_name text,
  updated_by_type text,
  updated_by_id text,
  updated_by_name text,
  published_at timestamptz,
  published_by_type text,
  published_by_id text,
  published_by_name text,
  ended_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gsa_site_campaigns_internal_name_check CHECK (char_length(trim(internal_name)) BETWEEN 3 AND 120),
  CONSTRAINT gsa_site_campaigns_title_check CHECK (char_length(trim(title)) BETWEEN 3 AND 160),
  CONSTRAINT gsa_site_campaigns_category_check CHECK (category IN ('announcement','promotion','news','alert','maintenance','event','system_update','institutional')),
  CONSTRAINT gsa_site_campaigns_format_check CHECK (format IN ('popup','top_bar','inline_banner','floating_card','fullscreen')),
  CONSTRAINT gsa_site_campaigns_template_check CHECK (template IN ('institutional_light','institutional_dark','promotion','alert','maintenance','launch')),
  CONSTRAINT gsa_site_campaigns_status_check CHECK (status IN ('draft','scheduled','active','paused','ended','archived')),
  CONSTRAINT gsa_site_campaigns_priority_check CHECK (priority BETWEEN 1 AND 1000),
  CONSTRAINT gsa_site_campaigns_target_check CHECK (cta_target IN ('_self','_blank')),
  CONSTRAINT gsa_site_campaigns_audience_check CHECK (audience IN ('all','guests','authenticated','clients')),
  CONSTRAINT gsa_site_campaigns_frequency_check CHECK (frequency_model IN ('every_visit','once_per_session','once_per_visitor','once_per_day','interval_days','until_click','until_close')),
  CONSTRAINT gsa_site_campaigns_frequency_value_check CHECK (frequency_value IS NULL OR frequency_value BETWEEN 1 AND 365),
  CONSTRAINT gsa_site_campaigns_auto_close_check CHECK (auto_close_seconds IS NULL OR auto_close_seconds BETWEEN 1 AND 3600),
  CONSTRAINT gsa_site_campaigns_period_check CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at),
  CONSTRAINT gsa_site_campaigns_pages_check CHECK (cardinality(target_pages) > 0),
  CONSTRAINT gsa_site_campaigns_devices_check CHECK (cardinality(devices) > 0 AND devices <@ ARRAY['desktop','tablet','mobile']::text[])
);

CREATE TABLE IF NOT EXISTS public.gsa_site_campaign_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.gsa_site_campaigns(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  page text NOT NULL,
  device text NOT NULL,
  audience text NOT NULL,
  viewer_hash text NOT NULL,
  session_hash text NOT NULL,
  actor_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gsa_site_campaign_events_type_check CHECK (event_type IN ('impression','click','close')),
  CONSTRAINT gsa_site_campaign_events_device_check CHECK (device IN ('desktop','tablet','mobile')),
  CONSTRAINT gsa_site_campaign_events_audience_check CHECK (audience IN ('guests','authenticated','clients')),
  CONSTRAINT gsa_site_campaign_events_viewer_check CHECK (char_length(viewer_hash) BETWEEN 8 AND 200),
  CONSTRAINT gsa_site_campaign_events_session_check CHECK (char_length(session_hash) BETWEEN 8 AND 200)
);

CREATE TABLE IF NOT EXISTS public.gsa_site_campaign_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.gsa_site_campaigns(id) ON DELETE SET NULL,
  campaign_name text,
  action text NOT NULL,
  actor_type text NOT NULL,
  actor_id text,
  actor_name text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gsa_site_campaigns_delivery ON public.gsa_site_campaigns(status, starts_at, ends_at, priority DESC);
CREATE INDEX IF NOT EXISTS idx_gsa_site_campaigns_updated ON public.gsa_site_campaigns(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_gsa_site_campaign_events_campaign_type_created ON public.gsa_site_campaign_events(campaign_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gsa_site_campaign_events_viewer ON public.gsa_site_campaign_events(campaign_id, viewer_hash, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gsa_site_campaign_events_session ON public.gsa_site_campaign_events(campaign_id, session_hash, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gsa_site_campaign_events_created ON public.gsa_site_campaign_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gsa_site_campaign_history_created ON public.gsa_site_campaign_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gsa_site_campaign_history_campaign ON public.gsa_site_campaign_history(campaign_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.gsa_site_campaign_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gsa_site_campaign_touch ON public.gsa_site_campaigns;
CREATE TRIGGER trg_gsa_site_campaign_touch
BEFORE UPDATE ON public.gsa_site_campaigns
FOR EACH ROW EXECUTE FUNCTION public.gsa_site_campaign_touch_updated_at();

CREATE OR REPLACE FUNCTION public.gsa_site_campaign_safe_url(p_url text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v text := trim(COALESCE(p_url, ''));
BEGIN
  IF v = '' THEN RETURN true; END IF;
  IF v ~ '[[:cntrl:]]' THEN RETURN false; END IF;
  IF v ~ '^/([^/].*)?$' THEN RETURN true; END IF;
  RETURN lower(v) ~ '^https://[^[:space:]]+$' OR lower(v) ~ '^http://[^[:space:]]+$';
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_site_campaign_page_matches(p_targets text[], p_page text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM unnest(COALESCE(p_targets, ARRAY['*']::text[])) AS target
    WHERE target = '*'
       OR target = COALESCE(NULLIF(p_page, ''), '/')
       OR (right(target, 2) = '/*' AND COALESCE(NULLIF(p_page, ''), '/') LIKE left(target, char_length(target) - 1) || '%')
  );
$$;

CREATE OR REPLACE FUNCTION public.gsa_site_campaign_refresh_states()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item record;
BEGIN
  FOR v_item IN
    UPDATE public.gsa_site_campaigns
       SET status = 'active', published_at = COALESCE(published_at, now())
     WHERE status = 'scheduled'
       AND COALESCE(starts_at, now()) <= now()
       AND (ends_at IS NULL OR ends_at > now())
     RETURNING id, internal_name
  LOOP
    INSERT INTO public.gsa_site_campaign_history(campaign_id, campaign_name, action, actor_type, actor_name)
    VALUES (v_item.id, v_item.internal_name, 'AUTO_ACTIVATED', 'system', 'Automação do sistema');
  END LOOP;

  FOR v_item IN
    UPDATE public.gsa_site_campaigns
       SET status = 'ended', ended_at = COALESCE(ended_at, now())
     WHERE status IN ('active','scheduled','paused')
       AND ends_at IS NOT NULL
       AND ends_at <= now()
     RETURNING id, internal_name
  LOOP
    INSERT INTO public.gsa_site_campaign_history(campaign_id, campaign_name, action, actor_type, actor_name)
    VALUES (v_item.id, v_item.internal_name, 'AUTO_ENDED', 'system', 'Automação do sistema');
  END LOOP;
END;
$$;

ALTER TABLE public.gsa_site_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gsa_site_campaign_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gsa_site_campaign_history ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.gsa_site_campaigns FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.gsa_site_campaign_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.gsa_site_campaign_history FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.gsa_site_campaigns TO service_role;
GRANT ALL ON public.gsa_site_campaign_events TO service_role;
GRANT ALL ON public.gsa_site_campaign_history TO service_role;

REVOKE ALL ON FUNCTION public.gsa_site_campaign_touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_site_campaign_refresh_states() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_site_campaign_refresh_states() TO service_role;

COMMIT;
