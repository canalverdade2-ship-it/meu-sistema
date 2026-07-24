BEGIN;

CREATE OR REPLACE FUNCTION public.gsa_public_site_campaigns(
  p_page text DEFAULT '/',
  p_device text DEFAULT 'desktop',
  p_audience text DEFAULT 'guests',
  p_viewer_hash text DEFAULT NULL,
  p_session_hash text DEFAULT NULL,
  p_actor_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_page text := left(COALESCE(NULLIF(trim(p_page), ''), '/'), 500);
  v_device text := lower(COALESCE(p_device, 'desktop'));
  v_viewer text;
  v_session text;
  v_actor_type text := COALESCE(auth.jwt() -> 'app_metadata' ->> 'gsa_actor_type', '');
  v_actor_id text := auth.jwt() -> 'app_metadata' ->> 'gsa_actor_id';
  v_audience text;
  v_result jsonb;
BEGIN
  IF v_device NOT IN ('desktop','tablet','mobile') THEN
    RAISE EXCEPTION 'Dispositivo inválido';
  END IF;
  IF p_viewer_hash IS NULL OR char_length(p_viewer_hash) NOT BETWEEN 8 AND 200 THEN
    RAISE EXCEPTION 'Identificador de visitante inválido';
  END IF;
  IF p_session_hash IS NULL OR char_length(p_session_hash) NOT BETWEEN 8 AND 200 THEN
    RAISE EXCEPTION 'Identificador de sessão inválido';
  END IF;

  v_viewer := encode(digest(p_viewer_hash, 'sha256'), 'hex');
  v_session := encode(digest(p_session_hash, 'sha256'), 'hex');
  v_audience := CASE
    WHEN auth.uid() IS NULL THEN 'guests'
    WHEN v_actor_type = 'cliente' THEN 'clients'
    ELSE 'authenticated'
  END;

  PERFORM pg_advisory_xact_lock(hashtextextended('gsa-site-campaign:' || v_viewer, 0));
  PERFORM public.gsa_site_campaign_refresh_states();

  WITH candidates AS (
    SELECT c.*,
      CASE WHEN c.format IN ('popup','fullscreen') THEN 'modal' ELSE c.format END AS display_slot
    FROM public.gsa_site_campaigns c
    WHERE c.status = 'active'
      AND COALESCE(c.starts_at, '-infinity'::timestamptz) <= now()
      AND COALESCE(c.ends_at, 'infinity'::timestamptz) > now()
      AND v_device = ANY(c.devices)
      AND public.gsa_site_campaign_page_matches(c.target_pages, v_page)
      AND (
        c.audience = 'all'
        OR c.audience = v_audience
        OR (c.audience = 'authenticated' AND v_audience = 'clients')
      )
      AND (
        c.frequency_model = 'every_visit'
        OR (c.frequency_model = 'once_per_session' AND NOT EXISTS (
          SELECT 1 FROM public.gsa_site_campaign_events e
          WHERE e.campaign_id = c.id AND e.session_hash = v_session AND e.event_type = 'impression'
        ))
        OR (c.frequency_model = 'once_per_visitor' AND NOT EXISTS (
          SELECT 1 FROM public.gsa_site_campaign_events e
          WHERE e.campaign_id = c.id AND e.viewer_hash = v_viewer AND e.event_type = 'impression'
        ))
        OR (c.frequency_model = 'once_per_day' AND NOT EXISTS (
          SELECT 1 FROM public.gsa_site_campaign_events e
          WHERE e.campaign_id = c.id AND e.viewer_hash = v_viewer AND e.event_type = 'impression' AND e.created_at >= now() - interval '1 day'
        ))
        OR (c.frequency_model = 'interval_days' AND NOT EXISTS (
          SELECT 1 FROM public.gsa_site_campaign_events e
          WHERE e.campaign_id = c.id AND e.viewer_hash = v_viewer AND e.event_type = 'impression'
            AND e.created_at >= now() - make_interval(days => GREATEST(COALESCE(c.frequency_value, 1), 1))
        ))
        OR (c.frequency_model = 'until_click' AND NOT EXISTS (
          SELECT 1 FROM public.gsa_site_campaign_events e
          WHERE e.campaign_id = c.id AND e.viewer_hash = v_viewer AND e.event_type = 'click'
        ))
        OR (c.frequency_model = 'until_close' AND NOT EXISTS (
          SELECT 1 FROM public.gsa_site_campaign_events e
          WHERE e.campaign_id = c.id AND e.viewer_hash = v_viewer AND e.event_type = 'close'
        ))
      )
  ), ranked AS (
    SELECT candidates.*, row_number() OVER (PARTITION BY display_slot ORDER BY priority DESC, updated_at DESC, id) AS slot_rank
    FROM candidates
  ), selected AS (
    SELECT * FROM ranked WHERE slot_rank = 1 ORDER BY priority DESC, updated_at DESC LIMIT 5
  ), impressions AS (
    INSERT INTO public.gsa_site_campaign_events(
      campaign_id, event_type, page, device, audience, viewer_hash, session_hash, actor_id, metadata
    )
    SELECT id, 'impression', v_page, v_device, v_audience, v_viewer, v_session, v_actor_id, '{}'::jsonb
    FROM selected
    RETURNING campaign_id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'internal_name', s.internal_name,
    'title', s.title,
    'subtitle', s.subtitle,
    'body', s.body,
    'category', s.category,
    'format', s.format,
    'template', s.template,
    'status', s.status,
    'priority', s.priority,
    'cta_label', s.cta_label,
    'cta_url', s.cta_url,
    'cta_target', s.cta_target,
    'secondary_cta_label', s.secondary_cta_label,
    'secondary_cta_url', s.secondary_cta_url,
    'image_desktop_url', s.image_desktop_url,
    'image_mobile_url', s.image_mobile_url,
    'image_alt', s.image_alt,
    'target_pages', s.target_pages,
    'audience', s.audience,
    'devices', s.devices,
    'starts_at', s.starts_at,
    'ends_at', s.ends_at,
    'frequency_model', s.frequency_model,
    'frequency_value', s.frequency_value,
    'dismissible', s.dismissible,
    'dismiss_on_backdrop', s.dismiss_on_backdrop,
    'dismiss_on_escape', s.dismiss_on_escape,
    'auto_close_seconds', s.auto_close_seconds,
    'created_at', s.created_at,
    'updated_at', s.updated_at
  ) ORDER BY s.priority DESC, s.updated_at DESC), '[]'::jsonb)
  INTO v_result
  FROM selected s;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_public_site_campaign_event(
  p_campaign_id uuid,
  p_event_type text,
  p_page text DEFAULT '/',
  p_device text DEFAULT 'desktop',
  p_audience text DEFAULT 'guests',
  p_viewer_hash text DEFAULT NULL,
  p_session_hash text DEFAULT NULL,
  p_actor_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event text := lower(COALESCE(p_event_type, ''));
  v_device text := lower(COALESCE(p_device, 'desktop'));
  v_page text := left(COALESCE(NULLIF(trim(p_page), ''), '/'), 500);
  v_viewer text;
  v_session text;
  v_actor_type text := COALESCE(auth.jwt() -> 'app_metadata' ->> 'gsa_actor_type', '');
  v_actor_id text := auth.jwt() -> 'app_metadata' ->> 'gsa_actor_id';
  v_audience text;
BEGIN
  IF v_event NOT IN ('click','close') THEN RAISE EXCEPTION 'Evento inválido'; END IF;
  IF v_device NOT IN ('desktop','tablet','mobile') THEN RAISE EXCEPTION 'Dispositivo inválido'; END IF;
  IF p_viewer_hash IS NULL OR char_length(p_viewer_hash) NOT BETWEEN 8 AND 200 THEN RAISE EXCEPTION 'Visitante inválido'; END IF;
  IF p_session_hash IS NULL OR char_length(p_session_hash) NOT BETWEEN 8 AND 200 THEN RAISE EXCEPTION 'Sessão inválida'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.gsa_site_campaigns WHERE id = p_campaign_id) THEN RAISE EXCEPTION 'Campanha não encontrada'; END IF;

  v_viewer := encode(digest(p_viewer_hash, 'sha256'), 'hex');
  v_session := encode(digest(p_session_hash, 'sha256'), 'hex');
  v_audience := CASE WHEN auth.uid() IS NULL THEN 'guests' WHEN v_actor_type = 'cliente' THEN 'clients' ELSE 'authenticated' END;

  PERFORM pg_advisory_xact_lock(hashtextextended('gsa-site-campaign-event:' || p_campaign_id::text || ':' || v_viewer, 0));

  IF NOT EXISTS (
    SELECT 1 FROM public.gsa_site_campaign_events
    WHERE campaign_id = p_campaign_id
      AND viewer_hash = v_viewer
      AND session_hash = v_session
      AND event_type = 'impression'
      AND created_at >= now() - interval '24 hours'
  ) THEN
    RAISE EXCEPTION 'Exibição da campanha não confirmada';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.gsa_site_campaign_events
    WHERE campaign_id = p_campaign_id
      AND viewer_hash = v_viewer
      AND session_hash = v_session
      AND event_type = v_event
      AND created_at >= now() - interval '3 seconds'
  ) THEN
    RETURN jsonb_build_object('success', true, 'duplicate', true);
  END IF;

  INSERT INTO public.gsa_site_campaign_events(
    campaign_id, event_type, page, device, audience, viewer_hash, session_hash, actor_id, metadata
  ) VALUES (
    p_campaign_id, v_event, v_page, v_device, v_audience, v_viewer, v_session, v_actor_id,
    CASE WHEN jsonb_typeof(COALESCE(p_metadata, '{}'::jsonb)) = 'object' THEN COALESCE(p_metadata, '{}'::jsonb) ELSE '{}'::jsonb END
  );

  RETURN jsonb_build_object('success', true, 'duplicate', false);
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_public_site_campaigns(text,text,text,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gsa_public_site_campaign_event(uuid,text,text,text,text,text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_public_site_campaigns(text,text,text,text,text,text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_public_site_campaign_event(uuid,text,text,text,text,text,text,text,jsonb) TO anon, authenticated, service_role;

COMMIT;
