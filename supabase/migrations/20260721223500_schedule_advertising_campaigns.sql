BEGIN;

DO $schedule$
DECLARE
  v_job_id bigint;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron'
  ) THEN
    RAISE NOTICE 'pg_cron não disponível; o motor continuará atualizando campanhas sob demanda.';
    RETURN;
  END IF;

  CREATE EXTENSION IF NOT EXISTS pg_cron;

  IF to_regnamespace('cron') IS NULL THEN
    RAISE NOTICE 'Schema cron não disponível após habilitar extensão.';
    RETURN;
  END IF;

  FOR v_job_id IN
    SELECT jobid FROM cron.job WHERE jobname = 'gsa-advertising-state-refresh'
  LOOP
    PERFORM cron.unschedule(v_job_id);
  END LOOP;

  PERFORM cron.schedule(
    'gsa-advertising-state-refresh',
    '*/5 * * * *',
    'SELECT public.gsa_ads_refresh_campaign_states();'
  );
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Sem permissão para configurar pg_cron; atualização sob demanda permanece ativa.';
  WHEN undefined_table OR undefined_function THEN
    RAISE NOTICE 'Objetos do pg_cron não disponíveis; atualização sob demanda permanece ativa.';
END;
$schedule$;

COMMIT;
