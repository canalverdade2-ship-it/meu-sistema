BEGIN;

-- A seleção, a validação dos limites e o registro de uma impressão precisam
-- acontecer na mesma fila lógica. O lock global é propositalmente conservador:
-- uma campanha pode estar vinculada a posições diferentes, portanto locks por
-- posição ainda permitiriam ultrapassar o limite total em chamadas concorrentes.
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
  IF nullif(trim(p_placement_code), '') IS NULL
     OR nullif(trim(p_viewer_hash), '') IS NULL
     OR nullif(trim(p_session_hash), '') IS NULL THEN
    RAISE EXCEPTION 'Identificadores de entrega inválidos' USING ERRCODE = '22023';
  END IF;

  -- Garante que duas posições diferentes não consumam simultaneamente o mesmo
  -- saldo de impressões ou a mesma janela de frequência de uma campanha.
  PERFORM pg_advisory_xact_lock(hashtextextended('gsa_ads_serve:global', 0));
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
      SELECT x.*
        FROM public.gsa_ad_creatives x
       WHERE x.campaign_id = c.id
         AND x.status = 'approved'
       ORDER BY x.approved_at DESC NULLS LAST, x.created_at DESC
       LIMIT 1
    ) cr ON true
   WHERE c.status = 'active'
     AND c.paid_at IS NOT NULL
     AND COALESCE(c.starts_at, now()) <= now()
     AND (c.ends_at IS NULL OR c.ends_at > now())
     AND (p_device IS NULL OR p_device = ANY(p.devices))
     AND (
       c.impression_limit IS NULL
       OR COALESCE((
         SELECT sum(m.served)
           FROM public.gsa_ad_daily_metrics m
          WHERE m.campaign_id = c.id
       ), 0) < c.impression_limit
     )
     AND (
       c.frequency_model = 'unlimited'
       OR (
         c.frequency_model = 'once_per_session'
         AND NOT EXISTS (
           SELECT 1
             FROM public.gsa_ad_delivery_events e
            WHERE e.campaign_id = c.id
              AND e.session_hash = p_session_hash
         )
       )
       OR (
         c.frequency_model = 'once_per_day'
         AND NOT EXISTS (
           SELECT 1
             FROM public.gsa_ad_delivery_events e
            WHERE e.campaign_id = c.id
              AND e.viewer_hash = p_viewer_hash
              AND e.served_at >= current_date
         )
       )
       OR (
         c.frequency_model = 'interval_hours'
         AND NOT EXISTS (
           SELECT 1
             FROM public.gsa_ad_delivery_events e
            WHERE e.campaign_id = c.id
              AND e.viewer_hash = p_viewer_hash
              AND e.served_at >= now() - make_interval(hours => GREATEST(COALESCE(c.frequency_value, 1), 1))
         )
       )
       OR (
         c.frequency_model = 'daily_limit'
         AND (
           SELECT count(*)
             FROM public.gsa_ad_delivery_events e
            WHERE e.campaign_id = c.id
              AND e.viewer_hash = p_viewer_hash
              AND e.served_at >= current_date
         ) < GREATEST(COALESCE(c.frequency_value, 1), 1)
       )
     )
   ORDER BY cp.priority ASC, md5(c.id::text || p_viewer_hash || current_date::text)
   LIMIT 1;

  IF v_pick.campaign_id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'ad', NULL);
  END IF;

  INSERT INTO public.gsa_ad_delivery_events(
    campaign_id, placement_id, creative_id, viewer_hash, session_hash, route, device
  ) VALUES (
    v_pick.campaign_id, v_pick.placement_id, v_pick.creative_id, p_viewer_hash, p_session_hash,
    nullif(p_route, ''), nullif(p_device, '')
  )
  RETURNING event_token INTO v_token;

  INSERT INTO public.gsa_ad_daily_metrics(campaign_id, placement_id, metric_date, requests, served)
  VALUES (v_pick.campaign_id, v_pick.placement_id, current_date, 1, 1)
  ON CONFLICT (campaign_id, placement_id, metric_date) DO UPDATE
    SET requests = public.gsa_ad_daily_metrics.requests + 1,
        served = public.gsa_ad_daily_metrics.served + 1;

  RETURN jsonb_build_object(
    'success', true,
    'event_token', v_token,
    'ad', jsonb_build_object(
      'campaign_id', v_pick.campaign_id,
      'name', v_pick.name,
      'slug', v_pick.slug,
      'advertiser_name', COALESCE(v_pick.trade_name, v_pick.legal_name),
      'placement_code', v_pick.placement_code,
      'creative_id', v_pick.creative_id,
      'kind', v_pick.kind,
      'storage_path', v_pick.storage_path,
      'target_url', v_pick.target_url,
      'headline', v_pick.headline,
      'body', v_pick.body,
      'alt_text', v_pick.alt_text,
      'width', v_pick.width,
      'height', v_pick.height,
      'duration_seconds', v_pick.duration_seconds
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_ads_serve(text,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_ads_serve(text,text,text,text,text) TO service_role;

COMMIT;
