BEGIN;

-- GSA TV: all administrative access is session-bound. The browser never reads
-- operational tables directly and stream secrets are never returned by RPCs.
ALTER TABLE public.gsa_tv_channels
  ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS desired_state text NOT NULL DEFAULT 'stopped',
  ADD COLUMN IF NOT EXISTS playout_state text NOT NULL DEFAULT 'off_air',
  ADD COLUMN IF NOT EXISTS signal_state text NOT NULL DEFAULT 'stopped',
  ADD COLUMN IF NOT EXISTS last_signal_at timestamptz;
ALTER TABLE public.gsa_tv_jobs
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS finished_at timestamptz,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS result jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.gsa_tv_schedule_slots
  DROP CONSTRAINT IF EXISTS gsa_tv_schedule_slots_valid_period;
ALTER TABLE public.gsa_tv_schedule_slots
  ADD CONSTRAINT gsa_tv_schedule_slots_valid_period
  CHECK (scheduled_end > scheduled_start);
ALTER TABLE public.gsa_tv_media_items
  ADD COLUMN IF NOT EXISTS media_kind text NOT NULL DEFAULT 'program',
  ADD COLUMN IF NOT EXISTS advertiser_name text,
  ADD COLUMN IF NOT EXISTS campaign_name text,
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'uploaded',
  ADD COLUMN IF NOT EXISTS ai_generated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approval_state text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.gsa_tv_media_items
  DROP CONSTRAINT IF EXISTS gsa_tv_media_duration_positive;
ALTER TABLE public.gsa_tv_media_items
  ADD CONSTRAINT gsa_tv_media_duration_positive CHECK (duration_s > 0);

CREATE INDEX IF NOT EXISTS idx_gsa_tv_schedule_channel_period
  ON public.gsa_tv_schedule_slots(channel_id, scheduled_start, scheduled_end);
CREATE INDEX IF NOT EXISTS idx_gsa_tv_jobs_status_created
  ON public.gsa_tv_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_gsa_tv_audit_created
  ON public.gsa_tv_audit_log(created_at DESC);

DO $$
DECLARE v_table text; v_policy record;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'gsa_tv_channels','gsa_tv_media_items','gsa_tv_schedule_slots',
    'gsa_tv_playlists','gsa_tv_incidents','gsa_tv_audit_log','gsa_tv_jobs'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    FOR v_policy IN
      SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=v_table
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_policy.policyname, v_table);
    END LOOP;
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', v_table);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', v_table);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      v_table || '_service_only', v_table
    );
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.gsa_tv_admin_context(
  p_sessao_id uuid,
  p_session_token text
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE v_context jsonb;
BEGIN
  v_context := public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('sistema');
  RETURN v_context;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_tv_write_audit(
  p_context jsonb,
  p_channel_id text,
  p_action text,
  p_resource_type text,
  p_resource_id text,
  p_details jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  INSERT INTO public.gsa_tv_audit_log(
    channel_id, actor, action, resource_type, resource_id, ip_address, details
  ) VALUES (
    p_channel_id,
    COALESCE(NULLIF(p_context->>'actor_name',''), p_context->>'actor_type', 'Administrador'),
    p_action, p_resource_type, p_resource_id, NULL,
    COALESCE(p_details, '{}'::jsonb) || jsonb_build_object(
      'actor_type', p_context->>'actor_type',
      'actor_id', p_context->>'actor_id',
      'session_id', p_context->>'session_id'
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_gsa_tv_snapshot(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_context jsonb;
  v_channel jsonb;
BEGIN
  v_context := public.gsa_tv_admin_context(p_sessao_id, p_session_token);

  SELECT jsonb_build_object(
    'id', c.id, 'name', c.name, 'slug', c.slug, 'status', c.status,
    'stream_url', c.stream_url, 'quality_profile', c.quality_profile,
    'config', c.config - 'stream_key' - 'youtube_stream_key' - 'rtmp_key',
    'last_heartbeat_at', c.last_heartbeat_at, 'last_error', c.last_error,
    'desired_state', c.desired_state, 'playout_state', c.playout_state,
    'signal_state', c.signal_state, 'last_signal_at', c.last_signal_at,
    'created_at', c.created_at, 'updated_at', c.updated_at
  ) INTO v_channel
  FROM public.gsa_tv_channels c ORDER BY c.created_at LIMIT 1;

  RETURN jsonb_build_object(
    'channel', v_channel,
    'media', COALESCE((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.created_at DESC)
      FROM public.gsa_tv_media_items m), '[]'::jsonb),
    'schedule', COALESCE((SELECT jsonb_agg(
      to_jsonb(s) || jsonb_build_object('media_title', m.title)
      ORDER BY s.scheduled_start)
      FROM public.gsa_tv_schedule_slots s
      LEFT JOIN public.gsa_tv_media_items m ON m.id=s.media_item_id
      WHERE s.scheduled_end >= now() - interval '1 day'), '[]'::jsonb),
    'playlists', COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.updated_at DESC)
      FROM public.gsa_tv_playlists p), '[]'::jsonb),
    'incidents', COALESCE((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.created_at DESC)
      FROM (SELECT * FROM public.gsa_tv_incidents ORDER BY created_at DESC LIMIT 100) i), '[]'::jsonb),
    'jobs', COALESCE((SELECT jsonb_agg(to_jsonb(j) ORDER BY j.created_at DESC)
      FROM (SELECT * FROM public.gsa_tv_jobs ORDER BY created_at DESC LIMIT 100) j), '[]'::jsonb),
    'audit', COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.created_at DESC)
      FROM (SELECT * FROM public.gsa_tv_audit_log ORDER BY created_at DESC LIMIT 100) a), '[]'::jsonb),
    'server_time', now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_gsa_tv_mutate(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_action text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_context jsonb := public.gsa_tv_admin_context(p_sessao_id, p_session_token);
  v_action text := lower(trim(COALESCE(p_action,'')));
  v_channel_id text := COALESCE(NULLIF(p_payload->>'channel_id',''), 'ch-main');
  v_id text;
  v_uuid uuid;
  v_media public.gsa_tv_media_items%ROWTYPE;
  v_start timestamptz;
  v_end timestamptz;
  v_job_type text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.gsa_tv_channels WHERE id=v_channel_id) THEN
    RAISE EXCEPTION 'Canal da GSA TV não encontrado.' USING ERRCODE='P0002';
  END IF;

  IF v_action='save_media' THEN
    v_id := COALESCE(NULLIF(p_payload->>'id',''), 'media-' || gen_random_uuid()::text);
    IF length(trim(COALESCE(p_payload->>'title',''))) < 2 THEN
      RAISE EXCEPTION 'Informe um título válido.' USING ERRCODE='22023';
    END IF;
    IF COALESCE((p_payload->>'duration_s')::integer,0) <= 0 THEN
      RAISE EXCEPTION 'A duração deve ser maior que zero.' USING ERRCODE='22023';
    END IF;
    INSERT INTO public.gsa_tv_media_items(
      id, channel_id, title, original_filename, duration_s, state, rights_ok,
      rights_expires_at, drive_path, media_kind, advertiser_name, campaign_name,
      source_type, ai_generated, approval_state, updated_at
    ) VALUES (
      v_id, v_channel_id, trim(p_payload->>'title'), NULLIF(p_payload->>'original_filename',''),
      (p_payload->>'duration_s')::integer,
      CASE WHEN p_payload->>'state' IN ('processing','ready','failed','blocked') THEN p_payload->>'state' ELSE 'processing' END,
      COALESCE((p_payload->>'rights_ok')::boolean,false),
      NULLIF(p_payload->>'rights_expires_at','')::timestamptz,
      NULLIF(p_payload->>'drive_path',''),
      CASE WHEN p_payload->>'media_kind' IN ('program','advertising','identity','filler') THEN p_payload->>'media_kind' ELSE 'program' END,
      NULLIF(trim(p_payload->>'advertiser_name'),''), NULLIF(trim(p_payload->>'campaign_name'),''),
      CASE WHEN p_payload->>'source_type' IN ('uploaded','ai','marketplace','services','remote') THEN p_payload->>'source_type' ELSE 'uploaded' END,
      COALESCE((p_payload->>'ai_generated')::boolean,false),
      CASE WHEN p_payload->>'approval_state' IN ('draft','pending','approved','rejected','expired') THEN p_payload->>'approval_state' ELSE 'pending' END,
      now()
    ) ON CONFLICT (id) DO UPDATE SET
      title=EXCLUDED.title, duration_s=EXCLUDED.duration_s, state=EXCLUDED.state,
      rights_ok=EXCLUDED.rights_ok, rights_expires_at=EXCLUDED.rights_expires_at,
      drive_path=EXCLUDED.drive_path, media_kind=EXCLUDED.media_kind,
      advertiser_name=EXCLUDED.advertiser_name, campaign_name=EXCLUDED.campaign_name,
      source_type=EXCLUDED.source_type, ai_generated=EXCLUDED.ai_generated,
      approval_state=EXCLUDED.approval_state, updated_at=now();
    PERFORM public.gsa_tv_write_audit(v_context,v_channel_id,'media_saved','media',v_id,p_payload - 'stream_key');
    RETURN jsonb_build_object('success',true,'id',v_id);

  ELSIF v_action='delete_media' THEN
    v_id := p_payload->>'id';
    IF EXISTS (SELECT 1 FROM public.gsa_tv_schedule_slots WHERE media_item_id=v_id AND scheduled_end>now()) THEN
      RAISE EXCEPTION 'A mídia está vinculada a uma programação futura.' USING ERRCODE='23503';
    END IF;
    DELETE FROM public.gsa_tv_media_items WHERE id=v_id RETURNING * INTO v_media;
    IF NOT FOUND THEN RAISE EXCEPTION 'Mídia não encontrada.' USING ERRCODE='P0002'; END IF;
    PERFORM public.gsa_tv_write_audit(v_context,v_channel_id,'media_deleted','media',v_id,jsonb_build_object('title',v_media.title));
    RETURN jsonb_build_object('success',true);

  ELSIF v_action='save_slot' THEN
    v_id := COALESCE(NULLIF(p_payload->>'id',''), 'slot-' || gen_random_uuid()::text);
    v_start := NULLIF(p_payload->>'scheduled_start','')::timestamptz;
    v_end := NULLIF(p_payload->>'scheduled_end','')::timestamptz;
    IF v_start IS NULL OR v_end IS NULL OR v_end<=v_start THEN
      RAISE EXCEPTION 'Informe início e fim válidos.' USING ERRCODE='22023';
    END IF;
    SELECT * INTO v_media FROM public.gsa_tv_media_items WHERE id=p_payload->>'media_item_id';
    IF NOT FOUND OR v_media.state<>'ready' OR NOT v_media.rights_ok OR
       (v_media.media_kind='advertising' AND v_media.approval_state<>'approved') OR
       (v_media.rights_expires_at IS NOT NULL AND v_media.rights_expires_at<v_end) THEN
      RAISE EXCEPTION 'A mídia não está pronta ou não possui direitos válidos para o período.' USING ERRCODE='22023';
    END IF;
    IF EXISTS (SELECT 1 FROM public.gsa_tv_schedule_slots s
      WHERE s.channel_id=v_channel_id AND s.id<>v_id AND s.state<>'cancelled'
        AND tstzrange(s.scheduled_start,s.scheduled_end,'[)') && tstzrange(v_start,v_end,'[)')) THEN
      RAISE EXCEPTION 'Existe conflito com outra programação neste período.' USING ERRCODE='23P01';
    END IF;
    INSERT INTO public.gsa_tv_schedule_slots(id,channel_id,media_item_id,scheduled_start,scheduled_end,slot_type,title_override,state,updated_at)
    VALUES(v_id,v_channel_id,v_media.id,v_start,v_end,
      CASE WHEN p_payload->>'slot_type' IN ('program','commercial','filler','live') THEN p_payload->>'slot_type' ELSE 'program' END,
      NULLIF(p_payload->>'title_override',''),'confirmed',now())
    ON CONFLICT(id) DO UPDATE SET media_item_id=EXCLUDED.media_item_id,
      scheduled_start=EXCLUDED.scheduled_start,scheduled_end=EXCLUDED.scheduled_end,
      slot_type=EXCLUDED.slot_type,title_override=EXCLUDED.title_override,state='confirmed',updated_at=now();
    PERFORM public.gsa_tv_write_audit(v_context,v_channel_id,'slot_saved','schedule',v_id,p_payload);
    RETURN jsonb_build_object('success',true,'id',v_id);

  ELSIF v_action='delete_slot' THEN
    v_id := p_payload->>'id';
    DELETE FROM public.gsa_tv_schedule_slots WHERE id=v_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Programação não encontrada.' USING ERRCODE='P0002'; END IF;
    PERFORM public.gsa_tv_write_audit(v_context,v_channel_id,'slot_deleted','schedule',v_id,'{}'::jsonb);
    RETURN jsonb_build_object('success',true);

  ELSIF v_action='update_channel' THEN
    IF p_payload ? 'stream_key' OR p_payload ? 'youtube_stream_key' OR p_payload ? 'rtmp_key' THEN
      RAISE EXCEPTION 'Segredos de transmissão não podem ser alterados pelo navegador.' USING ERRCODE='42501';
    END IF;
    IF COALESCE(p_payload->>'quality_profile','') NOT IN ('720p30','1080p30','1080p60') THEN
      RAISE EXCEPTION 'Perfil de qualidade inválido.' USING ERRCODE='22023';
    END IF;
    UPDATE public.gsa_tv_channels SET
      name=COALESCE(NULLIF(trim(p_payload->>'name'),''),name),
      quality_profile=p_payload->>'quality_profile',
      config=(config - 'stream_key' - 'youtube_stream_key' - 'rtmp_key') ||
        (COALESCE(p_payload->'config','{}'::jsonb) - 'stream_key' - 'youtube_stream_key' - 'rtmp_key'),
      updated_at=now()
    WHERE id=v_channel_id;
    PERFORM public.gsa_tv_write_audit(v_context,v_channel_id,'channel_updated','channel',v_channel_id,p_payload);
    RETURN jsonb_build_object('success',true);

  ELSIF v_action='enqueue_job' THEN
    v_job_type := lower(trim(COALESCE(p_payload->>'job_type','')));
    IF v_job_type NOT IN ('compile_playlist','cache_warmup','cache_cleanup','probe_media','validate_schedule','playout_reload','health_check','stream_start','stream_pause','stream_resume','stream_stop','credentials_check','relay_check','graphics_reload','live_take','live_return') THEN
      RAISE EXCEPTION 'Tipo de tarefa operacional não permitido.' USING ERRCODE='22023';
    END IF;
    IF EXISTS (SELECT 1 FROM public.gsa_tv_jobs WHERE channel_id=v_channel_id AND job_type=v_job_type AND status IN ('pending','running')) THEN
      RAISE EXCEPTION 'Já existe uma tarefa deste tipo em andamento.' USING ERRCODE='55000';
    END IF;
    INSERT INTO public.gsa_tv_jobs(channel_id,job_type,status,progress,payload)
    VALUES(v_channel_id,v_job_type,'pending',0,COALESCE(p_payload->'payload','{}'::jsonb)) RETURNING id INTO v_uuid;
    PERFORM public.gsa_tv_write_audit(v_context,v_channel_id,'job_enqueued','job',v_uuid::text,jsonb_build_object('job_type',v_job_type));
    RETURN jsonb_build_object('success',true,'id',v_uuid,'status','pending');

  ELSIF v_action='resolve_incident' THEN
    v_uuid := NULLIF(p_payload->>'id','')::uuid;
    UPDATE public.gsa_tv_incidents SET resolved=true,resolved_at=now() WHERE id=v_uuid AND NOT resolved;
    IF NOT FOUND THEN RAISE EXCEPTION 'Incidente não encontrado ou já resolvido.' USING ERRCODE='P0002'; END IF;
    PERFORM public.gsa_tv_write_audit(v_context,v_channel_id,'incident_resolved','incident',v_uuid::text,'{}'::jsonb);
    RETURN jsonb_build_object('success',true);
  END IF;

  RAISE EXCEPTION 'Ação administrativa da GSA TV não permitida.' USING ERRCODE='42501';
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_tv_admin_context(uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gsa_tv_write_audit(jsonb,text,text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gsa_admin_gsa_tv_snapshot(uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.gsa_admin_gsa_tv_mutate(uuid,text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gsa_tv_admin_context(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gsa_tv_write_audit(jsonb,text,text,text,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_gsa_tv_snapshot(uuid,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_gsa_tv_mutate(uuid,text,text,jsonb) TO authenticated,service_role;

-- Remove any legacy secret that may have been copied from source code. Runtime
-- secrets must live only in the protected service environment.
UPDATE public.gsa_tv_channels
SET stream_key=NULL,
    config=config - 'stream_key' - 'youtube_stream_key' - 'rtmp_key',
    updated_at=now()
WHERE stream_key IS NOT NULL OR config ?| ARRAY['stream_key','youtube_stream_key','rtmp_key'];

COMMIT;
