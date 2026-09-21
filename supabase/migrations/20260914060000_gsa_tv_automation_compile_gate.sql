BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

CREATE OR REPLACE FUNCTION public.gsa_tv_production_signature(p_version uuid)
RETURNS text LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
 SELECT md5(coalesce(string_agg(jsonb_build_array(
   b.id,b.program_id,b.planned_start_offset_s,b.planned_duration_s,b.media_item_id,
   m.state,m.approval_state,m.rights_ok,m.rights_expires_at,m.drive_path,m.duration_s,m.updated_at
 )::text,'|' ORDER BY b.planned_start_offset_s,b.id),''))
 FROM public.gsa_tv_program_blocks b
 LEFT JOIN public.gsa_tv_media_items m ON m.id=b.media_item_id AND m.channel_id='ch-main'
 WHERE b.schedule_version_id=p_version;
$$;

CREATE OR REPLACE FUNCTION public.gsa_tv_guard_automation_compile()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE v_id uuid; v_date date; v_signature text;
BEGIN
 IF NEW.channel_id<>'ch-main' OR NEW.job_type<>'compile_playlist' THEN RETURN NEW; END IF;
 v_date:=(now() AT TIME ZONE 'America/Sao_Paulo')::date;
 SELECT id INTO v_id FROM public.gsa_tv_schedule_versions
  WHERE channel_id=NEW.channel_id AND broadcast_date=v_date AND state='published'
  ORDER BY version DESC LIMIT 1;
 IF v_id IS NULL THEN RAISE EXCEPTION 'GSA TV: nenhuma grade publicada para hoje'; END IF;
 v_signature:=public.gsa_tv_production_signature(v_id);
 IF NOT EXISTS (
   SELECT 1 FROM public.gsa_tv_audit_log a
   WHERE a.channel_id=NEW.channel_id AND a.actor='night-production'
    AND a.action='automation_report' AND a.resource_id='production_readiness'
    AND a.created_at>now()-interval '10 minutes'
    AND a.details->>'state'='ready'
    AND a.details->>'date'=v_date::text
    AND a.details->>'schedule_version_id'=v_id::text
    AND a.details->>'schedule_signature'=v_signature
 ) THEN
   RAISE EXCEPTION 'GSA TV: compilação bloqueada; execute a verificação dos arquivos e resolva as pendências da grade';
 END IF;
 RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS gsa_tv_automation_compile_gate ON public.gsa_tv_jobs;
CREATE TRIGGER gsa_tv_automation_compile_gate BEFORE INSERT ON public.gsa_tv_jobs
 FOR EACH ROW EXECUTE FUNCTION public.gsa_tv_guard_automation_compile();

COMMENT ON FUNCTION public.gsa_tv_guard_automation_compile() IS
 'Gates queued compilation from all schedulers against a fresh verified schedule; does not send stream commands.';
COMMIT;
