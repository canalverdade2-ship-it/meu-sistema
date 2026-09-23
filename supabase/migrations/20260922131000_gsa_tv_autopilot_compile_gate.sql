BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

CREATE OR REPLACE FUNCTION public.gsa_tv_guard_automation_compile()
RETURNS trigger
LANGUAGE plpgsql
SET search_path=public,pg_temp
AS $$
DECLARE
  v_id uuid;
  v_date date;
  v_today date;
  v_signature text;
BEGIN
  IF NEW.channel_id <> 'ch-main' OR NEW.job_type <> 'compile_playlist' THEN
    RETURN NEW;
  END IF;

  v_today := (now() AT TIME ZONE 'America/Sao_Paulo')::date;

  BEGIN
    v_date := COALESCE(NULLIF(NEW.payload->>'date','')::date, v_today);
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'GSA TV: data de compilação inválida';
  END;

  IF v_date < v_today OR v_date > v_today + 7 THEN
    RAISE EXCEPTION 'GSA TV: compilação automática permitida somente entre hoje e D+7';
  END IF;

  SELECT id
    INTO v_id
    FROM public.gsa_tv_schedule_versions
   WHERE channel_id = NEW.channel_id
     AND broadcast_date = v_date
     AND state = 'published'
   ORDER BY version DESC
   LIMIT 1;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'GSA TV: nenhuma grade publicada para %', v_date;
  END IF;

  v_signature := public.gsa_tv_production_signature(v_id);

  IF NOT EXISTS (
    SELECT 1
      FROM public.gsa_tv_audit_log a
     WHERE a.channel_id = NEW.channel_id
       AND a.actor = 'night-production'
       AND a.action = 'automation_report'
       AND a.resource_id = 'production_readiness'
       AND a.created_at > now() - interval '10 minutes'
       AND a.details->>'state' = 'ready'
       AND a.details->>'date' = v_date::text
       AND a.details->>'schedule_version_id' = v_id::text
       AND a.details->>'schedule_signature' = v_signature
  ) THEN
    RAISE EXCEPTION
      'GSA TV: compilação bloqueada para %; execute a verificação e resolva as pendências da grade',
      v_date;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.gsa_tv_guard_automation_compile() IS
  'Protege compile_playlist para hoje..D+7 exigindo readiness recente e assinatura exata da grade solicitada.';

DROP TRIGGER IF EXISTS gsa_tv_automation_compile_gate ON public.gsa_tv_jobs;
CREATE TRIGGER gsa_tv_automation_compile_gate
BEFORE INSERT ON public.gsa_tv_jobs
FOR EACH ROW
EXECUTE FUNCTION public.gsa_tv_guard_automation_compile();

COMMIT;
