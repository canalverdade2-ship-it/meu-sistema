BEGIN;

ALTER TABLE public.gsa_tv_execution_log
  ADD COLUMN IF NOT EXISTS schedule_version_id uuid REFERENCES public.gsa_tv_schedule_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS program_block_id uuid REFERENCES public.gsa_tv_program_blocks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.gsa_tv_ad_campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS episode_id uuid REFERENCES public.gsa_tv_episodes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_reprise boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS live_source_id uuid REFERENCES public.gsa_tv_live_sources(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS episode_id uuid REFERENCES public.gsa_tv_episodes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS operator_name text;

CREATE INDEX IF NOT EXISTS gsa_tv_execution_campaign_idx
  ON public.gsa_tv_execution_log(campaign_id,started_at DESC)
  WHERE campaign_id IS NOT NULL;

ALTER TABLE public.gsa_tv_ai_provider_secrets
  ADD COLUMN IF NOT EXISTS image_model text NOT NULL DEFAULT 'gpt-image-2',
  ADD COLUMN IF NOT EXISTS speech_model text NOT NULL DEFAULT 'gpt-4o-mini-tts',
  ADD COLUMN IF NOT EXISTS video_model text NOT NULL DEFAULT 'sora-2',
  ADD COLUMN IF NOT EXISTS daily_budget numeric(12,4),
  ADD COLUMN IF NOT EXISTS monthly_budget numeric(12,4),
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.gsa_tv_ai_assets
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS size_bytes bigint,
  ADD COLUMN IF NOT EXISTS sha256 text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;CREATE TABLE IF NOT EXISTS public.gsa_tv_live_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id text NOT NULL REFERENCES public.gsa_tv_channels(id) ON DELETE CASCADE,
  live_source_id uuid REFERENCES public.gsa_tv_live_sources(id) ON DELETE SET NULL,
  media_item_id text REFERENCES public.gsa_tv_media_items(id) ON DELETE SET NULL,
  state text NOT NULL DEFAULT 'recording' CHECK (state IN ('recording','processing','ready','failed','cancelled')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  file_path text,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gsa_tv_live_recordings_time_idx
  ON public.gsa_tv_live_recordings(channel_id,started_at DESC);

CREATE TABLE IF NOT EXISTS public.gsa_tv_alert_settings (
  channel_id text PRIMARY KEY REFERENCES public.gsa_tv_channels(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  whatsapp_number text,
  min_severity text NOT NULL DEFAULT 'warning' CHECK (min_severity IN ('info','warning','error','critical')),
  cooldown_minutes integer NOT NULL DEFAULT 10 CHECK (cooldown_minutes BETWEEN 1 AND 1440),
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);CREATE TABLE IF NOT EXISTS public.gsa_tv_alert_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id text NOT NULL REFERENCES public.gsa_tv_channels(id) ON DELETE CASCADE,
  incident_id uuid REFERENCES public.gsa_tv_incidents(id) ON DELETE SET NULL,
  severity text NOT NULL,
  destination_hash text,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','sent','failed','suppressed')),
  message text NOT NULL,
  response_status integer,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE INDEX IF NOT EXISTS gsa_tv_alert_delivery_time_idx
  ON public.gsa_tv_alert_deliveries(channel_id,created_at DESC);

CREATE TABLE IF NOT EXISTS public.gsa_tv_backup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id text NOT NULL REFERENCES public.gsa_tv_channels(id) ON DELETE CASCADE,
  backup_type text NOT NULL,
  state text NOT NULL CHECK (state IN ('running','completed','failed','verified','restored_test')),
  archive_path text,
  sha256 text,
  size_bytes bigint,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);CREATE TABLE IF NOT EXISTS public.gsa_tv_ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id text NOT NULL REFERENCES public.gsa_tv_channels(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.gsa_tv_ai_projects(id) ON DELETE SET NULL,
  job_id uuid REFERENCES public.gsa_tv_ai_jobs(id) ON DELETE SET NULL,
  provider text NOT NULL,
  model text NOT NULL,
  operation text NOT NULL,
  input_units bigint,
  output_units bigint,
  cost_estimate numeric(12,4),
  cost_actual numeric(12,4),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gsa_tv_ai_usage_time_idx
  ON public.gsa_tv_ai_usage(channel_id,created_at DESC);

CREATE TABLE IF NOT EXISTS public.gsa_tv_ai_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id text NOT NULL REFERENCES public.gsa_tv_channels(id) ON DELETE CASCADE,
  memory_type text NOT NULL,
  key text NOT NULL,
  value jsonb NOT NULL,
  active boolean NOT NULL DEFAULT true,
  source text,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(channel_id,memory_type,key)
);CREATE OR REPLACE FUNCTION public.gsa_tv_media_delete_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.gsa_tv_schedule_slots s
    WHERE s.media_item_id=OLD.id AND s.state<>'cancelled' AND s.scheduled_end>now()
  ) THEN RAISE EXCEPTION 'Mídia vinculada a programação futura.' USING ERRCODE='23503'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.gsa_tv_program_blocks b
    JOIN public.gsa_tv_schedule_versions v ON v.id=b.schedule_version_id
    WHERE v.state IN ('approved','published','running') AND
      (b.media_item_id=OLD.id OR EXISTS(SELECT 1 FROM public.gsa_tv_episodes e WHERE e.id=b.episode_id AND e.media_item_id=OLD.id))
  ) THEN RAISE EXCEPTION 'Mídia vinculada a grade aprovada ou publicada.' USING ERRCODE='23503'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.gsa_tv_ad_assets a JOIN public.gsa_tv_ad_campaigns c ON c.id=a.campaign_id
    WHERE a.media_item_id=OLD.id AND c.status IN ('review','active','paused')
  ) THEN RAISE EXCEPTION 'Mídia vinculada a campanha vigente.' USING ERRCODE='23503'; END IF;
  IF EXISTS (SELECT 1 FROM public.gsa_tv_live_recordings r WHERE r.media_item_id=OLD.id AND r.state IN ('recording','processing'))
    THEN RAISE EXCEPTION 'Mídia ainda está em processamento de gravação.' USING ERRCODE='23503'; END IF;
  IF COALESCE((OLD.metadata->>'fallback_official')::boolean,false)
    THEN RAISE EXCEPTION 'Mídia configurada como fallback oficial.' USING ERRCODE='23503'; END IF;
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS gsa_tv_media_delete_guard_trg ON public.gsa_tv_media_items;
CREATE TRIGGER gsa_tv_media_delete_guard_trg BEFORE DELETE ON public.gsa_tv_media_items
FOR EACH ROW EXECUTE FUNCTION public.gsa_tv_media_delete_guard();DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY[
    'gsa_tv_live_recordings','gsa_tv_alert_settings','gsa_tv_alert_deliveries',
    'gsa_tv_backup_runs','gsa_tv_ai_usage','gsa_tv_ai_memory'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC,anon,authenticated',t);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role',t);
  END LOOP;
END $$;

INSERT INTO public.gsa_tv_alert_settings(channel_id,enabled,min_severity,cooldown_minutes)
SELECT id,true,'warning',10 FROM public.gsa_tv_channels
ON CONFLICT(channel_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.gsa_admin_gsa_tv_operations_snapshot(
  p_sessao_id uuid DEFAULT NULL,p_session_token text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb;
BEGIN
  c:=public.gsa_tv_admin_context(p_sessao_id,p_session_token);
  RETURN jsonb_build_object(
    'alerts',COALESCE((SELECT to_jsonb(x)-'whatsapp_number'||jsonb_build_object('whatsapp_configured',x.whatsapp_number IS NOT NULL) FROM public.gsa_tv_alert_settings x WHERE x.channel_id='ch-main'),'{}'::jsonb),
    'recordings',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.started_at DESC) FROM (SELECT * FROM public.gsa_tv_live_recordings ORDER BY started_at DESC LIMIT 100)x),'[]'::jsonb),
    'backups',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.started_at DESC) FROM (SELECT * FROM public.gsa_tv_backup_runs ORDER BY started_at DESC LIMIT 50)x),'[]'::jsonb),
    'ai_usage',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC) FROM (SELECT * FROM public.gsa_tv_ai_usage ORDER BY created_at DESC LIMIT 200)x),'[]'::jsonb),
    'ai_memory',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.updated_at DESC) FROM public.gsa_tv_ai_memory x WHERE x.active),'[]'::jsonb)
  );
END $$;CREATE OR REPLACE FUNCTION public.gsa_admin_gsa_tv_operations_mutate(
  p_sessao_id uuid DEFAULT NULL,p_session_token text DEFAULT NULL,
  p_action text DEFAULT '',p_payload jsonb DEFAULT '{}'
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=public.gsa_tv_admin_context(p_sessao_id,p_session_token);ch text:=COALESCE(NULLIF(p_payload->>'channel_id',''),'ch-main');rid uuid;
BEGIN
  IF p_action='save_alert_settings' THEN
    INSERT INTO public.gsa_tv_alert_settings(channel_id,enabled,whatsapp_number,min_severity,cooldown_minutes,updated_by,updated_at)
    VALUES(ch,COALESCE((p_payload->>'enabled')::boolean,true),NULLIF(regexp_replace(COALESCE(p_payload->>'whatsapp_number',''),'\D','','g'),''),
      CASE WHEN p_payload->>'min_severity' IN('info','warning','error','critical') THEN p_payload->>'min_severity' ELSE 'warning' END,
      LEAST(1440,GREATEST(1,COALESCE((p_payload->>'cooldown_minutes')::int,10))),COALESCE(c->>'actor_name','Administrador'),now())
    ON CONFLICT(channel_id) DO UPDATE SET enabled=EXCLUDED.enabled,
      whatsapp_number=COALESCE(EXCLUDED.whatsapp_number,public.gsa_tv_alert_settings.whatsapp_number),
      min_severity=EXCLUDED.min_severity,cooldown_minutes=EXCLUDED.cooldown_minutes,updated_by=EXCLUDED.updated_by,updated_at=now();
    PERFORM public.gsa_tv_write_audit(c,ch,'alert_settings_saved','operations',ch,p_payload-'whatsapp_number');
    RETURN jsonb_build_object('success',true);
  ELSIF p_action='save_ai_memory' THEN
    INSERT INTO public.gsa_tv_ai_memory(channel_id,memory_type,key,value,active,source,updated_by,updated_at)
    VALUES(ch,trim(p_payload->>'memory_type'),trim(p_payload->>'key'),COALESCE(p_payload->'value','{}'),COALESCE((p_payload->>'active')::boolean,true),
      COALESCE(NULLIF(p_payload->>'source',''),'manual'),COALESCE(c->>'actor_name','Administrador'),now())
    ON CONFLICT(channel_id,memory_type,key) DO UPDATE SET value=EXCLUDED.value,active=EXCLUDED.active,source=EXCLUDED.source,updated_by=EXCLUDED.updated_by,updated_at=now()
    RETURNING id INTO rid;
    PERFORM public.gsa_tv_write_audit(c,ch,'ai_memory_saved','ai_memory',rid::text,p_payload-'value');
    RETURN jsonb_build_object('success',true,'id',rid);
  ELSE RAISE EXCEPTION 'Ação operacional não suportada.'; END IF;
END $$;CREATE OR REPLACE FUNCTION public.gsa_tv_execution_complete_rollup() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  IF OLD.ended_at IS NULL AND NEW.ended_at IS NOT NULL THEN
    IF NEW.campaign_id IS NOT NULL AND NEW.outcome IN ('completed','in_progress') THEN
      UPDATE public.gsa_tv_ad_campaigns SET completed_runs=completed_runs+1,updated_at=now() WHERE id=NEW.campaign_id;
    END IF;
    IF NEW.episode_id IS NOT NULL AND NEW.outcome IN ('completed','in_progress') THEN
      UPDATE public.gsa_tv_episodes SET first_run_at=COALESCE(first_run_at,NEW.started_at),last_run_at=NEW.started_at,run_count=run_count+1,updated_at=now() WHERE id=NEW.episode_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS gsa_tv_execution_complete_rollup_trg ON public.gsa_tv_execution_log;
CREATE TRIGGER gsa_tv_execution_complete_rollup_trg AFTER UPDATE OF ended_at ON public.gsa_tv_execution_log
FOR EACH ROW EXECUTE FUNCTION public.gsa_tv_execution_complete_rollup();

REVOKE ALL ON FUNCTION public.gsa_admin_gsa_tv_operations_snapshot(uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.gsa_admin_gsa_tv_operations_mutate(uuid,text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_gsa_tv_operations_snapshot(uuid,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_gsa_tv_operations_mutate(uuid,text,text,jsonb) TO authenticated,service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
