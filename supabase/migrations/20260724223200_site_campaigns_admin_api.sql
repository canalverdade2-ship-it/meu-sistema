BEGIN;

CREATE OR REPLACE FUNCTION public.gsa_admin_site_campaigns_overview(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('avisos-campanhas');
  PERFORM public.gsa_site_campaign_refresh_states();

  SELECT jsonb_build_object(
    'campaigns', COALESCE((
      SELECT jsonb_agg(
        to_jsonb(c) || jsonb_build_object(
          'metrics', jsonb_build_object(
            'impressions', COALESCE(m.impressions, 0),
            'clicks', COALESCE(m.clicks, 0),
            'closes', COALESCE(m.closes, 0),
            'unique_viewers', COALESCE(m.unique_viewers, 0),
            'click_through_rate', CASE WHEN COALESCE(m.impressions, 0) = 0 THEN 0 ELSE round((m.clicks::numeric * 100) / m.impressions, 2) END
          )
        ) ORDER BY c.updated_at DESC
      )
      FROM public.gsa_site_campaigns c
      LEFT JOIN LATERAL (
        SELECT
          count(*) FILTER (WHERE event_type = 'impression')::integer AS impressions,
          count(*) FILTER (WHERE event_type = 'click')::integer AS clicks,
          count(*) FILTER (WHERE event_type = 'close')::integer AS closes,
          count(DISTINCT viewer_hash) FILTER (WHERE event_type = 'impression')::integer AS unique_viewers
        FROM public.gsa_site_campaign_events e
        WHERE e.campaign_id = c.id
      ) m ON true
    ), '[]'::jsonb),
    'history', COALESCE((
      SELECT jsonb_agg(to_jsonb(h) ORDER BY h.created_at DESC)
      FROM (SELECT * FROM public.gsa_site_campaign_history ORDER BY created_at DESC LIMIT 500) h
    ), '[]'::jsonb),
    'analytics', jsonb_build_object(
      'by_device', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'key', device,
          'impressions', impressions,
          'clicks', clicks,
          'closes', closes,
          'unique_viewers', unique_viewers,
          'click_through_rate', CASE WHEN impressions = 0 THEN 0 ELSE round((clicks::numeric * 100) / impressions, 2) END
        ) ORDER BY impressions DESC)
        FROM (
          SELECT device,
            count(*) FILTER (WHERE event_type = 'impression')::integer impressions,
            count(*) FILTER (WHERE event_type = 'click')::integer clicks,
            count(*) FILTER (WHERE event_type = 'close')::integer closes,
            count(DISTINCT viewer_hash) FILTER (WHERE event_type = 'impression')::integer unique_viewers
          FROM public.gsa_site_campaign_events
          WHERE created_at >= now() - interval '90 days'
          GROUP BY device
        ) d
      ), '[]'::jsonb),
      'by_page', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'key', page,
          'impressions', impressions,
          'clicks', clicks,
          'closes', closes,
          'unique_viewers', unique_viewers,
          'click_through_rate', CASE WHEN impressions = 0 THEN 0 ELSE round((clicks::numeric * 100) / impressions, 2) END
        ) ORDER BY impressions DESC)
        FROM (
          SELECT page,
            count(*) FILTER (WHERE event_type = 'impression')::integer impressions,
            count(*) FILTER (WHERE event_type = 'click')::integer clicks,
            count(*) FILTER (WHERE event_type = 'close')::integer closes,
            count(DISTINCT viewer_hash) FILTER (WHERE event_type = 'impression')::integer unique_viewers
          FROM public.gsa_site_campaign_events
          WHERE created_at >= now() - interval '90 days'
          GROUP BY page
          ORDER BY impressions DESC
          LIMIT 50
        ) p
      ), '[]'::jsonb),
      'by_day', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'key', day_key,
          'impressions', impressions,
          'clicks', clicks,
          'closes', closes,
          'unique_viewers', unique_viewers,
          'click_through_rate', CASE WHEN impressions = 0 THEN 0 ELSE round((clicks::numeric * 100) / impressions, 2) END
        ) ORDER BY day_key DESC)
        FROM (
          SELECT to_char(created_at AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') day_key,
            count(*) FILTER (WHERE event_type = 'impression')::integer impressions,
            count(*) FILTER (WHERE event_type = 'click')::integer clicks,
            count(*) FILTER (WHERE event_type = 'close')::integer closes,
            count(DISTINCT viewer_hash) FILTER (WHERE event_type = 'impression')::integer unique_viewers
          FROM public.gsa_site_campaign_events
          WHERE created_at >= now() - interval '30 days'
          GROUP BY 1
        ) x
      ), '[]'::jsonb)
    ),
    'totals', jsonb_build_object(
      'all', (SELECT count(*) FROM public.gsa_site_campaigns),
      'draft', (SELECT count(*) FROM public.gsa_site_campaigns WHERE status = 'draft'),
      'scheduled', (SELECT count(*) FROM public.gsa_site_campaigns WHERE status = 'scheduled'),
      'active', (SELECT count(*) FROM public.gsa_site_campaigns WHERE status = 'active'),
      'paused', (SELECT count(*) FROM public.gsa_site_campaigns WHERE status = 'paused'),
      'ended', (SELECT count(*) FROM public.gsa_site_campaigns WHERE status = 'ended'),
      'archived', (SELECT count(*) FROM public.gsa_site_campaigns WHERE status = 'archived'),
      'impressions', (SELECT count(*) FROM public.gsa_site_campaign_events WHERE event_type = 'impression'),
      'clicks', (SELECT count(*) FROM public.gsa_site_campaign_events WHERE event_type = 'click'),
      'click_through_rate', CASE
        WHEN (SELECT count(*) FROM public.gsa_site_campaign_events WHERE event_type = 'impression') = 0 THEN 0
        ELSE round(
          ((SELECT count(*) FROM public.gsa_site_campaign_events WHERE event_type = 'click')::numeric * 100)
          / (SELECT count(*) FROM public.gsa_site_campaign_events WHERE event_type = 'impression'), 2
        )
      END
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_upsert_site_campaign(
  p_campaign_id uuid DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_context jsonb := public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  v_actor_type text := v_context ->> 'actor_type';
  v_actor_id text := v_context ->> 'actor_id';
  v_actor_name text := COALESCE(v_context ->> 'actor_name', v_context ->> 'name', 'Usuário administrativo');
  v_pages text[];
  v_devices text[];
  v_old public.gsa_site_campaigns%ROWTYPE;
  v_saved public.gsa_site_campaigns%ROWTYPE;
  v_starts timestamptz;
  v_ends timestamptz;
  v_cta_url text := NULLIF(trim(p_payload ->> 'cta_url'), '');
  v_secondary_url text := NULLIF(trim(p_payload ->> 'secondary_cta_url'), '');
BEGIN
  PERFORM public.gsa_admin_assert_module('avisos-campanhas');
  IF jsonb_typeof(COALESCE(p_payload, '{}'::jsonb)) <> 'object' THEN RAISE EXCEPTION 'Conteúdo inválido'; END IF;

  SELECT COALESCE(array_agg(trim(value)), ARRAY[]::text[])
    INTO v_pages
  FROM jsonb_array_elements_text(COALESCE(p_payload -> 'target_pages', '[]'::jsonb));
  SELECT COALESCE(array_agg(trim(value)), ARRAY[]::text[])
    INTO v_devices
  FROM jsonb_array_elements_text(COALESCE(p_payload -> 'devices', '[]'::jsonb));

  v_starts := NULLIF(p_payload ->> 'starts_at', '')::timestamptz;
  v_ends := NULLIF(p_payload ->> 'ends_at', '')::timestamptz;

  IF char_length(trim(COALESCE(p_payload ->> 'internal_name', ''))) NOT BETWEEN 3 AND 120 THEN RAISE EXCEPTION 'Nome interno inválido'; END IF;
  IF char_length(trim(COALESCE(p_payload ->> 'title', ''))) NOT BETWEEN 3 AND 160 THEN RAISE EXCEPTION 'Título inválido'; END IF;
  IF COALESCE(p_payload ->> 'category', '') NOT IN ('announcement','promotion','news','alert','maintenance','event','system_update','institutional') THEN RAISE EXCEPTION 'Categoria inválida'; END IF;
  IF COALESCE(p_payload ->> 'format', '') NOT IN ('popup','top_bar','inline_banner','floating_card','fullscreen') THEN RAISE EXCEPTION 'Formato inválido'; END IF;
  IF COALESCE(p_payload ->> 'template', '') NOT IN ('institutional_light','institutional_dark','promotion','alert','maintenance','launch') THEN RAISE EXCEPTION 'Modelo inválido'; END IF;
  IF COALESCE(p_payload ->> 'audience', '') NOT IN ('all','guests','authenticated','clients') THEN RAISE EXCEPTION 'Público inválido'; END IF;
  IF COALESCE(p_payload ->> 'frequency_model', '') NOT IN ('every_visit','once_per_session','once_per_visitor','once_per_day','interval_days','until_click','until_close') THEN RAISE EXCEPTION 'Frequência inválida'; END IF;
  IF COALESCE(p_payload ->> 'cta_target', '_self') NOT IN ('_self','_blank') THEN RAISE EXCEPTION 'Destino de abertura inválido'; END IF;
  IF cardinality(v_pages) = 0 OR EXISTS (SELECT 1 FROM unnest(v_pages) p WHERE p = '' OR char_length(p) > 300 OR (p <> '*' AND left(p, 1) <> '/') OR p ~ '[[:cntrl:]]') THEN RAISE EXCEPTION 'Páginas de exibição inválidas'; END IF;
  IF cardinality(v_devices) = 0 OR NOT v_devices <@ ARRAY['desktop','tablet','mobile']::text[] THEN RAISE EXCEPTION 'Dispositivos inválidos'; END IF;
  IF NOT public.gsa_site_campaign_safe_url(v_cta_url) OR NOT public.gsa_site_campaign_safe_url(v_secondary_url) THEN RAISE EXCEPTION 'Link inseguro ou inválido'; END IF;
  IF NULLIF(trim(p_payload ->> 'cta_label'), '') IS NOT NULL AND v_cta_url IS NULL THEN RAISE EXCEPTION 'Destino principal obrigatório'; END IF;
  IF NULLIF(trim(p_payload ->> 'secondary_cta_label'), '') IS NOT NULL AND v_secondary_url IS NULL THEN RAISE EXCEPTION 'Destino secundário obrigatório'; END IF;
  IF v_ends IS NOT NULL AND v_starts IS NOT NULL AND v_ends <= v_starts THEN RAISE EXCEPTION 'Período inválido'; END IF;

  IF p_campaign_id IS NOT NULL THEN
    SELECT * INTO v_old FROM public.gsa_site_campaigns WHERE id = p_campaign_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Campanha não encontrada'; END IF;
    IF v_old.status = 'archived' THEN RAISE EXCEPTION 'Campanhas arquivadas não podem ser editadas'; END IF;
  END IF;

  IF p_campaign_id IS NULL THEN
    INSERT INTO public.gsa_site_campaigns(
      internal_name,title,subtitle,body,category,format,template,priority,cta_label,cta_url,cta_target,
      secondary_cta_label,secondary_cta_url,image_desktop_url,image_mobile_url,image_alt,target_pages,audience,
      devices,starts_at,ends_at,frequency_model,frequency_value,dismissible,dismiss_on_backdrop,dismiss_on_escape,
      auto_close_seconds,created_by_type,created_by_id,created_by_name,updated_by_type,updated_by_id,updated_by_name
    ) VALUES (
      trim(p_payload ->> 'internal_name'), trim(p_payload ->> 'title'), NULLIF(trim(p_payload ->> 'subtitle'), ''),
      NULLIF(trim(p_payload ->> 'body'), ''), p_payload ->> 'category', p_payload ->> 'format', p_payload ->> 'template',
      LEAST(GREATEST(COALESCE((p_payload ->> 'priority')::integer,50),1),1000), NULLIF(trim(p_payload ->> 'cta_label'), ''),
      v_cta_url, COALESCE(p_payload ->> 'cta_target','_self'), NULLIF(trim(p_payload ->> 'secondary_cta_label'), ''),
      v_secondary_url, NULLIF(trim(p_payload ->> 'image_desktop_url'), ''), NULLIF(trim(p_payload ->> 'image_mobile_url'), ''),
      NULLIF(trim(p_payload ->> 'image_alt'), ''), v_pages, p_payload ->> 'audience', v_devices, v_starts, v_ends,
      p_payload ->> 'frequency_model', NULLIF(p_payload ->> 'frequency_value','')::integer,
      COALESCE((p_payload ->> 'dismissible')::boolean,true), COALESCE((p_payload ->> 'dismiss_on_backdrop')::boolean,true),
      COALESCE((p_payload ->> 'dismiss_on_escape')::boolean,true), NULLIF(p_payload ->> 'auto_close_seconds','')::integer,
      v_actor_type,v_actor_id,v_actor_name,v_actor_type,v_actor_id,v_actor_name
    ) RETURNING * INTO v_saved;

    INSERT INTO public.gsa_site_campaign_history(campaign_id,campaign_name,action,actor_type,actor_id,actor_name,details)
    VALUES(v_saved.id,v_saved.internal_name,'CREATED',v_actor_type,v_actor_id,v_actor_name,jsonb_build_object('after',to_jsonb(v_saved)));
  ELSE
    UPDATE public.gsa_site_campaigns SET
      internal_name=trim(p_payload ->> 'internal_name'), title=trim(p_payload ->> 'title'), subtitle=NULLIF(trim(p_payload ->> 'subtitle'), ''),
      body=NULLIF(trim(p_payload ->> 'body'), ''), category=p_payload ->> 'category', format=p_payload ->> 'format', template=p_payload ->> 'template',
      priority=LEAST(GREATEST(COALESCE((p_payload ->> 'priority')::integer,50),1),1000), cta_label=NULLIF(trim(p_payload ->> 'cta_label'), ''),
      cta_url=v_cta_url, cta_target=COALESCE(p_payload ->> 'cta_target','_self'), secondary_cta_label=NULLIF(trim(p_payload ->> 'secondary_cta_label'), ''),
      secondary_cta_url=v_secondary_url, image_desktop_url=NULLIF(trim(p_payload ->> 'image_desktop_url'), ''), image_mobile_url=NULLIF(trim(p_payload ->> 'image_mobile_url'), ''),
      image_alt=NULLIF(trim(p_payload ->> 'image_alt'), ''), target_pages=v_pages, audience=p_payload ->> 'audience', devices=v_devices,
      starts_at=v_starts, ends_at=v_ends, frequency_model=p_payload ->> 'frequency_model', frequency_value=NULLIF(p_payload ->> 'frequency_value','')::integer,
      dismissible=COALESCE((p_payload ->> 'dismissible')::boolean,true), dismiss_on_backdrop=COALESCE((p_payload ->> 'dismiss_on_backdrop')::boolean,true),
      dismiss_on_escape=COALESCE((p_payload ->> 'dismiss_on_escape')::boolean,true), auto_close_seconds=NULLIF(p_payload ->> 'auto_close_seconds','')::integer,
      updated_by_type=v_actor_type,updated_by_id=v_actor_id,updated_by_name=v_actor_name
    WHERE id=p_campaign_id RETURNING * INTO v_saved;

    INSERT INTO public.gsa_site_campaign_history(campaign_id,campaign_name,action,actor_type,actor_id,actor_name,details)
    VALUES(v_saved.id,v_saved.internal_name,'UPDATED',v_actor_type,v_actor_id,v_actor_name,jsonb_build_object('before',to_jsonb(v_old),'after',to_jsonb(v_saved)));
  END IF;

  RETURN jsonb_build_object('success',true,'campaign',to_jsonb(v_saved));
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_set_site_campaign_status(
  p_campaign_id uuid,
  p_action text,
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_context jsonb := public.gsa_admin_validate_context(p_sessao_id,p_session_token);
  v_actor_type text := v_context ->> 'actor_type';
  v_actor_id text := v_context ->> 'actor_id';
  v_actor_name text := COALESCE(v_context ->> 'actor_name',v_context ->> 'name','Usuário administrativo');
  v_action text := lower(trim(COALESCE(p_action,'')));
  v_old public.gsa_site_campaigns%ROWTYPE;
  v_saved public.gsa_site_campaigns%ROWTYPE;
BEGIN
  PERFORM public.gsa_admin_assert_module('avisos-campanhas');
  SELECT * INTO v_old FROM public.gsa_site_campaigns WHERE id=p_campaign_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Campanha não encontrada'; END IF;

  IF v_action='publish' THEN
    IF v_old.status NOT IN ('draft','ended') THEN RAISE EXCEPTION 'Esta campanha não pode ser publicada neste estado'; END IF;
    IF v_old.ends_at IS NOT NULL AND v_old.ends_at<=now() THEN RAISE EXCEPTION 'A data de encerramento já passou'; END IF;
    UPDATE public.gsa_site_campaigns SET
      status=CASE WHEN starts_at IS NOT NULL AND starts_at>now() THEN 'scheduled' ELSE 'active' END,
      published_at=now(),published_by_type=v_actor_type,published_by_id=v_actor_id,published_by_name=v_actor_name,
      ended_at=NULL,archived_at=NULL,updated_by_type=v_actor_type,updated_by_id=v_actor_id,updated_by_name=v_actor_name
    WHERE id=p_campaign_id RETURNING * INTO v_saved;
  ELSIF v_action='pause' THEN
    IF v_old.status NOT IN ('active','scheduled') THEN RAISE EXCEPTION 'Somente campanhas ativas ou agendadas podem ser pausadas'; END IF;
    UPDATE public.gsa_site_campaigns SET status='paused',updated_by_type=v_actor_type,updated_by_id=v_actor_id,updated_by_name=v_actor_name WHERE id=p_campaign_id RETURNING * INTO v_saved;
  ELSIF v_action='resume' THEN
    IF v_old.status<>'paused' THEN RAISE EXCEPTION 'Somente campanhas pausadas podem ser retomadas'; END IF;
    IF v_old.ends_at IS NOT NULL AND v_old.ends_at<=now() THEN RAISE EXCEPTION 'A campanha já atingiu o encerramento'; END IF;
    UPDATE public.gsa_site_campaigns SET status=CASE WHEN starts_at IS NOT NULL AND starts_at>now() THEN 'scheduled' ELSE 'active' END,updated_by_type=v_actor_type,updated_by_id=v_actor_id,updated_by_name=v_actor_name WHERE id=p_campaign_id RETURNING * INTO v_saved;
  ELSIF v_action='end' THEN
    IF v_old.status NOT IN ('active','scheduled','paused') THEN RAISE EXCEPTION 'Esta campanha não pode ser encerrada neste estado'; END IF;
    UPDATE public.gsa_site_campaigns SET status='ended',ended_at=now(),updated_by_type=v_actor_type,updated_by_id=v_actor_id,updated_by_name=v_actor_name WHERE id=p_campaign_id RETURNING * INTO v_saved;
  ELSIF v_action='archive' THEN
    IF v_old.status='archived' THEN RAISE EXCEPTION 'Campanha já arquivada'; END IF;
    UPDATE public.gsa_site_campaigns SET status='archived',archived_at=now(),updated_by_type=v_actor_type,updated_by_id=v_actor_id,updated_by_name=v_actor_name WHERE id=p_campaign_id RETURNING * INTO v_saved;
  ELSE
    RAISE EXCEPTION 'Ação inválida';
  END IF;

  INSERT INTO public.gsa_site_campaign_history(campaign_id,campaign_name,action,actor_type,actor_id,actor_name,details)
  VALUES(v_saved.id,v_saved.internal_name,upper(v_action),v_actor_type,v_actor_id,v_actor_name,jsonb_build_object('before_status',v_old.status,'after_status',v_saved.status));
  RETURN jsonb_build_object('success',true,'campaign',to_jsonb(v_saved));
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_duplicate_site_campaign(
  p_campaign_id uuid,
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_context jsonb := public.gsa_admin_validate_context(p_sessao_id,p_session_token);
  v_actor_type text := v_context ->> 'actor_type';
  v_actor_id text := v_context ->> 'actor_id';
  v_actor_name text := COALESCE(v_context ->> 'actor_name',v_context ->> 'name','Usuário administrativo');
  v_source public.gsa_site_campaigns%ROWTYPE;
  v_saved public.gsa_site_campaigns%ROWTYPE;
BEGIN
  PERFORM public.gsa_admin_assert_module('avisos-campanhas');
  SELECT * INTO v_source FROM public.gsa_site_campaigns WHERE id=p_campaign_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Campanha não encontrada'; END IF;

  INSERT INTO public.gsa_site_campaigns(
    internal_name,title,subtitle,body,category,format,template,status,priority,cta_label,cta_url,cta_target,
    secondary_cta_label,secondary_cta_url,image_desktop_url,image_mobile_url,image_alt,target_pages,audience,
    devices,starts_at,ends_at,frequency_model,frequency_value,dismissible,dismiss_on_backdrop,dismiss_on_escape,
    auto_close_seconds,created_by_type,created_by_id,created_by_name,updated_by_type,updated_by_id,updated_by_name
  ) VALUES (
    left(v_source.internal_name,110)||' (cópia)',v_source.title,v_source.subtitle,v_source.body,v_source.category,v_source.format,
    v_source.template,'draft',v_source.priority,v_source.cta_label,v_source.cta_url,v_source.cta_target,
    v_source.secondary_cta_label,v_source.secondary_cta_url,v_source.image_desktop_url,v_source.image_mobile_url,
    v_source.image_alt,v_source.target_pages,v_source.audience,v_source.devices,v_source.starts_at,v_source.ends_at,
    v_source.frequency_model,v_source.frequency_value,v_source.dismissible,v_source.dismiss_on_backdrop,v_source.dismiss_on_escape,
    v_source.auto_close_seconds,v_actor_type,v_actor_id,v_actor_name,v_actor_type,v_actor_id,v_actor_name
  ) RETURNING * INTO v_saved;

  INSERT INTO public.gsa_site_campaign_history(campaign_id,campaign_name,action,actor_type,actor_id,actor_name,details)
  VALUES(v_saved.id,v_saved.internal_name,'DUPLICATED',v_actor_type,v_actor_id,v_actor_name,jsonb_build_object('source_campaign_id',p_campaign_id));
  RETURN jsonb_build_object('success',true,'campaign',to_jsonb(v_saved));
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_site_campaigns_overview(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_upsert_site_campaign(uuid,jsonb,uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_set_site_campaign_status(uuid,text,uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_duplicate_site_campaign(uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_site_campaigns_overview(uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_upsert_site_campaign(uuid,jsonb,uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_set_site_campaign_status(uuid,text,uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_duplicate_site_campaign(uuid,uuid,text) TO authenticated, service_role;

COMMIT;
