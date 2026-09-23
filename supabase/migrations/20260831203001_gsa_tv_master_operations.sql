BEGIN;

CREATE TABLE IF NOT EXISTS public.gsa_tv_execution_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id text NOT NULL REFERENCES public.gsa_tv_channels(id) ON DELETE CASCADE,
  media_item_id text REFERENCES public.gsa_tv_media_items(id) ON DELETE SET NULL,
  schedule_slot_id text REFERENCES public.gsa_tv_schedule_slots(id) ON DELETE SET NULL,
  title text NOT NULL,
  source text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_s numeric(12,3),
  outcome text NOT NULL DEFAULT 'in_progress' CHECK (outcome IN ('in_progress','completed','interrupted','fallback','live')),
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gsa_tv_execution_log_time_idx ON public.gsa_tv_execution_log(channel_id,started_at DESC);

CREATE TABLE IF NOT EXISTS public.gsa_tv_watchdog_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id text NOT NULL REFERENCES public.gsa_tv_channels(id) ON DELETE CASCADE,
  control_plane_ok boolean NOT NULL,
  ffplayout_ok boolean NOT NULL,
  hls_ok boolean NOT NULL,
  hls_age_s numeric(10,3),
  signal_expected boolean NOT NULL,
  signal_state text NOT NULL,
  current_title text,
  black_detected boolean NOT NULL DEFAULT false,
  silence_detected boolean NOT NULL DEFAULT false,
  freeze_detected boolean NOT NULL DEFAULT false,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);CREATE INDEX IF NOT EXISTS gsa_tv_watchdog_samples_time_idx ON public.gsa_tv_watchdog_samples(channel_id,created_at DESC);

CREATE TABLE IF NOT EXISTS public.gsa_tv_graphics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id text NOT NULL REFERENCES public.gsa_tv_channels(id) ON DELETE CASCADE,
  layer_type text NOT NULL CHECK (layer_type IN ('logo','lower_third','ticker','bug')),
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  text_content text,
  media_item_id text REFERENCES public.gsa_tv_media_items(id) ON DELETE SET NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gsa_tv_graphics_channel_idx ON public.gsa_tv_graphics(channel_id,layer_type,enabled);

CREATE TABLE IF NOT EXISTS public.gsa_tv_live_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id text NOT NULL REFERENCES public.gsa_tv_channels(id) ON DELETE CASCADE,
  name text NOT NULL,
  protocol text NOT NULL CHECK (protocol IN ('rtmp','rtmps','srt','hls')),
  enabled boolean NOT NULL DEFAULT true,
  connection_configured boolean NOT NULL DEFAULT false,
  state text NOT NULL DEFAULT 'standby' CHECK (state IN ('standby','connecting','ready','live','failed','disabled')),
  last_seen_at timestamptz,
  public_notes text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gsa_tv_live_source_secrets (
  source_id uuid PRIMARY KEY REFERENCES public.gsa_tv_live_sources(id) ON DELETE CASCADE,
  connection_ciphertext text NOT NULL,
  encryption_version text NOT NULL DEFAULT 'v1',
  updated_at timestamptz NOT NULL DEFAULT now()
);CREATE TABLE IF NOT EXISTS public.gsa_tv_rights_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_item_id text NOT NULL REFERENCES public.gsa_tv_media_items(id) ON DELETE CASCADE,
  document_name text NOT NULL,
  document_type text NOT NULL DEFAULT 'authorization',
  storage_path text,
  valid_from timestamptz,
  valid_until timestamptz,
  verified boolean NOT NULL DEFAULT false,
  verified_by text,
  verified_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gsa_tv_rights_media_idx ON public.gsa_tv_rights_documents(media_item_id,valid_until);

CREATE TABLE IF NOT EXISTS public.gsa_tv_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id text NOT NULL REFERENCES public.gsa_tv_channels(id) ON DELETE CASCADE,
  advertiser_name text NOT NULL,
  name text NOT NULL,
  starts_at timestamptz,
  ends_at timestamptz,
  state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','pending','approved','active','paused','completed','rejected')),
  target_spots integer,
  delivered_spots integer NOT NULL DEFAULT 0,
  budget numeric(14,2),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gsa_tv_ai_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id text NOT NULL REFERENCES public.gsa_tv_channels(id) ON DELETE CASCADE,
  project_type text NOT NULL CHECK (project_type IN ('program','research','script','image','audio','video','advertising','ident','translation','quality')),
  title text NOT NULL,
  brief text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','queued','running','review','approved','rejected','completed','failed')),
  created_by text,
  output_media_item_id text REFERENCES public.gsa_tv_media_items(id) ON DELETE SET NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);CREATE TABLE IF NOT EXISTS public.gsa_tv_ai_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.gsa_tv_ai_projects(id) ON DELETE CASCADE,
  agent_type text NOT NULL,
  provider text,
  model text,
  state text NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','running','completed','failed','cancelled')),
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  output jsonb NOT NULL DEFAULT '{}'::jsonb,
  estimated_cost numeric(12,4),
  actual_cost numeric(12,4),
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gsa_tv_virtual_presenters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id text NOT NULL REFERENCES public.gsa_tv_channels(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','retired')),
  identity_locked boolean NOT NULL DEFAULT true,
  visual_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  voice_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  personality_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  pronunciation_lexicon jsonb NOT NULL DEFAULT '{}'::jsonb,
  provider_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gsa_tv_editorial_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id text NOT NULL REFERENCES public.gsa_tv_channels(id) ON DELETE CASCADE,
  version integer NOT NULL,
  active boolean NOT NULL DEFAULT false,
  policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(channel_id,version)
);DO $$
DECLARE v_table text; v_policy record;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'gsa_tv_execution_log','gsa_tv_watchdog_samples','gsa_tv_graphics','gsa_tv_live_sources',
    'gsa_tv_live_source_secrets','gsa_tv_rights_documents','gsa_tv_campaigns','gsa_tv_ai_projects',
    'gsa_tv_ai_jobs','gsa_tv_virtual_presenters','gsa_tv_editorial_policies'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',v_table);
    FOR v_policy IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=v_table LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',v_policy.policyname,v_table);
    END LOOP;
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC,anon,authenticated',v_table);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role',v_table);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',v_table||'_service_only',v_table);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.gsa_admin_gsa_tv_extended(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE v_context jsonb;
BEGIN
  v_context := public.gsa_tv_admin_context(p_sessao_id,p_session_token);
  RETURN jsonb_build_object(
    'execution',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.started_at DESC) FROM (SELECT * FROM public.gsa_tv_execution_log ORDER BY started_at DESC LIMIT 100) x),'[]'::jsonb),
    'watchdog',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC) FROM (SELECT * FROM public.gsa_tv_watchdog_samples ORDER BY created_at DESC LIMIT 120) x),'[]'::jsonb),
    'graphics',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.updated_at DESC) FROM public.gsa_tv_graphics x),'[]'::jsonb),
    'live_sources',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.updated_at DESC) FROM public.gsa_tv_live_sources x),'[]'::jsonb),
    'rights',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC) FROM public.gsa_tv_rights_documents x),'[]'::jsonb),
    'campaigns',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.updated_at DESC) FROM public.gsa_tv_campaigns x),'[]'::jsonb),
    'ai_projects',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.updated_at DESC) FROM public.gsa_tv_ai_projects x),'[]'::jsonb),
    'ai_jobs',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC) FROM (SELECT * FROM public.gsa_tv_ai_jobs ORDER BY created_at DESC LIMIT 100) x),'[]'::jsonb),
    'presenters',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.updated_at DESC) FROM public.gsa_tv_virtual_presenters x),'[]'::jsonb),
    'editorial_policies',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.version DESC) FROM public.gsa_tv_editorial_policies x),'[]'::jsonb),
    'server_time',now()
  );
END;
$$;CREATE OR REPLACE FUNCTION public.gsa_admin_gsa_tv_extended_mutate(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_action text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE
  v_context jsonb := public.gsa_tv_admin_context(p_sessao_id,p_session_token);
  v_action text := lower(trim(COALESCE(p_action,'')));
  v_channel_id text := COALESCE(NULLIF(p_payload->>'channel_id',''),'ch-main');
  v_uuid uuid;
  v_text_id text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.gsa_tv_channels WHERE id=v_channel_id) THEN
    RAISE EXCEPTION 'Canal da GSA TV não encontrado.' USING ERRCODE='P0002';
  END IF;

  IF v_action='save_graphic' THEN
    v_uuid := COALESCE(NULLIF(p_payload->>'id','')::uuid,gen_random_uuid());
    IF COALESCE(p_payload->>'layer_type','') NOT IN ('logo','lower_third','ticker','bug') THEN RAISE EXCEPTION 'Tipo de gráfico inválido.'; END IF;
    INSERT INTO public.gsa_tv_graphics(id,channel_id,layer_type,name,enabled,text_content,media_item_id,config,updated_at)
    VALUES(v_uuid,v_channel_id,p_payload->>'layer_type',COALESCE(NULLIF(trim(p_payload->>'name'),''),'Camada'),COALESCE((p_payload->>'enabled')::boolean,false),NULLIF(p_payload->>'text_content',''),NULLIF(p_payload->>'media_item_id',''),COALESCE(p_payload->'config','{}'::jsonb),now())
    ON CONFLICT(id) DO UPDATE SET layer_type=excluded.layer_type,name=excluded.name,enabled=excluded.enabled,text_content=excluded.text_content,media_item_id=excluded.media_item_id,config=excluded.config,updated_at=now();
    PERFORM public.gsa_tv_write_audit(v_context,v_channel_id,'graphic_saved','graphic',v_uuid::text,p_payload);
    RETURN jsonb_build_object('success',true,'id',v_uuid);
  ELSIF v_action='delete_graphic' THEN
    v_uuid := NULLIF(p_payload->>'id','')::uuid;
    DELETE FROM public.gsa_tv_graphics WHERE id=v_uuid AND channel_id=v_channel_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Camada gráfica não encontrada.'; END IF;
    PERFORM public.gsa_tv_write_audit(v_context,v_channel_id,'graphic_deleted','graphic',v_uuid::text,'{}'::jsonb);
    RETURN jsonb_build_object('success',true);
  END IF;  IF v_action='save_campaign' THEN
    v_uuid := COALESCE(NULLIF(p_payload->>'id','')::uuid,gen_random_uuid());
    INSERT INTO public.gsa_tv_campaigns(id,channel_id,advertiser_name,name,starts_at,ends_at,state,target_spots,budget,config,updated_at)
    VALUES(v_uuid,v_channel_id,trim(p_payload->>'advertiser_name'),trim(p_payload->>'name'),NULLIF(p_payload->>'starts_at','')::timestamptz,NULLIF(p_payload->>'ends_at','')::timestamptz,
      CASE WHEN p_payload->>'state' IN ('draft','pending','approved','active','paused','completed','rejected') THEN p_payload->>'state' ELSE 'draft' END,
      NULLIF(p_payload->>'target_spots','')::integer,NULLIF(p_payload->>'budget','')::numeric,COALESCE(p_payload->'config','{}'::jsonb),now())
    ON CONFLICT(id) DO UPDATE SET advertiser_name=excluded.advertiser_name,name=excluded.name,starts_at=excluded.starts_at,ends_at=excluded.ends_at,state=excluded.state,target_spots=excluded.target_spots,budget=excluded.budget,config=excluded.config,updated_at=now();
    PERFORM public.gsa_tv_write_audit(v_context,v_channel_id,'campaign_saved','campaign',v_uuid::text,p_payload);
    RETURN jsonb_build_object('success',true,'id',v_uuid);
  ELSIF v_action='approve_media' THEN
    v_text_id := NULLIF(p_payload->>'media_item_id','');
    UPDATE public.gsa_tv_media_items SET approval_state=CASE WHEN COALESCE((p_payload->>'approved')::boolean,false) THEN 'approved' ELSE 'rejected' END,updated_at=now() WHERE id=v_text_id AND channel_id=v_channel_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Mídia não encontrada.'; END IF;
    PERFORM public.gsa_tv_write_audit(v_context,v_channel_id,'media_approval_changed','media',v_text_id,jsonb_build_object('approved',COALESCE((p_payload->>'approved')::boolean,false)));
    RETURN jsonb_build_object('success',true);
  ELSIF v_action='save_rights_document' THEN
    v_uuid := COALESCE(NULLIF(p_payload->>'id','')::uuid,gen_random_uuid());
    v_text_id := NULLIF(p_payload->>'media_item_id','');
    IF NOT EXISTS (SELECT 1 FROM public.gsa_tv_media_items WHERE id=v_text_id AND channel_id=v_channel_id) THEN RAISE EXCEPTION 'Mídia não encontrada.'; END IF;
    INSERT INTO public.gsa_tv_rights_documents(id,media_item_id,document_name,document_type,storage_path,valid_from,valid_until,verified,verified_by,verified_at,metadata)
    VALUES(v_uuid,v_text_id,trim(p_payload->>'document_name'),COALESCE(NULLIF(p_payload->>'document_type',''),'authorization'),NULLIF(p_payload->>'storage_path',''),NULLIF(p_payload->>'valid_from','')::timestamptz,NULLIF(p_payload->>'valid_until','')::timestamptz,COALESCE((p_payload->>'verified')::boolean,false),CASE WHEN COALESCE((p_payload->>'verified')::boolean,false) THEN COALESCE(v_context->>'actor_name',v_context->>'actor_type') END,CASE WHEN COALESCE((p_payload->>'verified')::boolean,false) THEN now() END,COALESCE(p_payload->'metadata','{}'::jsonb))
    ON CONFLICT(id) DO UPDATE SET document_name=excluded.document_name,document_type=excluded.document_type,storage_path=excluded.storage_path,valid_from=excluded.valid_from,valid_until=excluded.valid_until,verified=excluded.verified,verified_by=excluded.verified_by,verified_at=excluded.verified_at,metadata=excluded.metadata;
    UPDATE public.gsa_tv_media_items SET rights_ok=EXISTS(SELECT 1 FROM public.gsa_tv_rights_documents r WHERE r.media_item_id=v_text_id AND r.verified AND (r.valid_until IS NULL OR r.valid_until>=now())),rights_expires_at=(SELECT max(r.valid_until) FROM public.gsa_tv_rights_documents r WHERE r.media_item_id=v_text_id AND r.verified),updated_at=now() WHERE id=v_text_id;
    PERFORM public.gsa_tv_write_audit(v_context,v_channel_id,'rights_document_saved','rights',v_uuid::text,p_payload - 'storage_path');
    RETURN jsonb_build_object('success',true,'id',v_uuid);
  END IF;  IF v_action='save_ai_project' THEN
    v_uuid := COALESCE(NULLIF(p_payload->>'id','')::uuid,gen_random_uuid());
    IF COALESCE(p_payload->>'project_type','') NOT IN ('program','research','script','image','audio','video','advertising','ident','translation','quality') THEN RAISE EXCEPTION 'Tipo de projeto de IA inválido.'; END IF;
    INSERT INTO public.gsa_tv_ai_projects(id,channel_id,project_type,title,brief,state,created_by,config,updated_at)
    VALUES(v_uuid,v_channel_id,p_payload->>'project_type',trim(p_payload->>'title'),COALESCE(p_payload->>'brief',''),CASE WHEN p_payload->>'state' IN ('draft','queued','running','review','approved','rejected','completed','failed') THEN p_payload->>'state' ELSE 'draft' END,COALESCE(v_context->>'actor_name',v_context->>'actor_type'),COALESCE(p_payload->'config','{}'::jsonb),now())
    ON CONFLICT(id) DO UPDATE SET project_type=excluded.project_type,title=excluded.title,brief=excluded.brief,state=excluded.state,config=excluded.config,updated_at=now();
    PERFORM public.gsa_tv_write_audit(v_context,v_channel_id,'ai_project_saved','ai_project',v_uuid::text,jsonb_build_object('project_type',p_payload->>'project_type','state',p_payload->>'state'));
    RETURN jsonb_build_object('success',true,'id',v_uuid);
  ELSIF v_action='save_presenter' THEN
    v_uuid := COALESCE(NULLIF(p_payload->>'id','')::uuid,gen_random_uuid());
    INSERT INTO public.gsa_tv_virtual_presenters(id,channel_id,name,status,identity_locked,visual_profile,voice_profile,personality_profile,pronunciation_lexicon,provider_config,updated_at)
    VALUES(v_uuid,v_channel_id,trim(p_payload->>'name'),CASE WHEN p_payload->>'status' IN ('draft','active','paused','retired') THEN p_payload->>'status' ELSE 'draft' END,COALESCE((p_payload->>'identity_locked')::boolean,true),COALESCE(p_payload->'visual_profile','{}'::jsonb),COALESCE(p_payload->'voice_profile','{}'::jsonb),COALESCE(p_payload->'personality_profile','{}'::jsonb),COALESCE(p_payload->'pronunciation_lexicon','{}'::jsonb),COALESCE(p_payload->'provider_config','{}'::jsonb),now())
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,status=excluded.status,identity_locked=excluded.identity_locked,visual_profile=excluded.visual_profile,voice_profile=excluded.voice_profile,personality_profile=excluded.personality_profile,pronunciation_lexicon=excluded.pronunciation_lexicon,provider_config=excluded.provider_config,updated_at=now();
    PERFORM public.gsa_tv_write_audit(v_context,v_channel_id,'presenter_saved','presenter',v_uuid::text,jsonb_build_object('name',p_payload->>'name','identity_locked',COALESCE((p_payload->>'identity_locked')::boolean,true)));
    RETURN jsonb_build_object('success',true,'id',v_uuid);
  ELSIF v_action='save_editorial_policy' THEN
    INSERT INTO public.gsa_tv_editorial_policies(channel_id,version,active,policy,created_by)
    VALUES(v_channel_id,COALESCE((p_payload->>'version')::integer,1),COALESCE((p_payload->>'active')::boolean,false),COALESCE(p_payload->'policy','{}'::jsonb),COALESCE(v_context->>'actor_name',v_context->>'actor_type'))
    ON CONFLICT(channel_id,version) DO UPDATE SET active=excluded.active,policy=excluded.policy,created_by=excluded.created_by;
    IF COALESCE((p_payload->>'active')::boolean,false) THEN UPDATE public.gsa_tv_editorial_policies SET active=false WHERE channel_id=v_channel_id AND version<>COALESCE((p_payload->>'version')::integer,1); END IF;
    PERFORM public.gsa_tv_write_audit(v_context,v_channel_id,'editorial_policy_saved','editorial_policy',COALESCE(p_payload->>'version','1'),'{}'::jsonb);
    RETURN jsonb_build_object('success',true);
  END IF;  IF v_action='save_live_source' THEN
    v_uuid := COALESCE(NULLIF(p_payload->>'id','')::uuid,gen_random_uuid());
    IF COALESCE(p_payload->>'protocol','') NOT IN ('rtmp','rtmps','srt','hls') THEN RAISE EXCEPTION 'Protocolo ao vivo inválido.'; END IF;
    INSERT INTO public.gsa_tv_live_sources(id,channel_id,name,protocol,enabled,state,public_notes,config,updated_at)
    VALUES(v_uuid,v_channel_id,trim(p_payload->>'name'),p_payload->>'protocol',COALESCE((p_payload->>'enabled')::boolean,true),CASE WHEN COALESCE((p_payload->>'enabled')::boolean,true) THEN 'standby' ELSE 'disabled' END,NULLIF(p_payload->>'public_notes',''),COALESCE(p_payload->'config','{}'::jsonb),now())
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,protocol=excluded.protocol,enabled=excluded.enabled,state=CASE WHEN excluded.enabled THEN CASE WHEN public.gsa_tv_live_sources.state='live' THEN 'live' ELSE 'standby' END ELSE 'disabled' END,public_notes=excluded.public_notes,config=excluded.config,updated_at=now();
    PERFORM public.gsa_tv_write_audit(v_context,v_channel_id,'live_source_saved','live_source',v_uuid::text,p_payload - 'connection_url' - 'secret');
    RETURN jsonb_build_object('success',true,'id',v_uuid);
  END IF;

  RAISE EXCEPTION 'Ação estendida da GSA TV não permitida.' USING ERRCODE='42501';
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_gsa_tv_extended(uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.gsa_admin_gsa_tv_extended_mutate(uuid,text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_gsa_tv_extended(uuid,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_gsa_tv_extended_mutate(uuid,text,text,jsonb) TO authenticated,service_role;

COMMIT;