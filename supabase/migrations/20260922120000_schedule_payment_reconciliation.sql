-- Migration para agendamento da reconciliação com pg_cron, pg_net e Supabase Vault

DO $$
DECLARE
  v_job_id integer;
BEGIN
  -- Habilitar extensões (podem falhar silenciosamente se o usuário não tiver role de superuser, 
  -- mas em Supabase cloud é permitido se forem suportadas).
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  CREATE EXTENSION IF NOT EXISTS pg_net;
  CREATE EXTENSION IF NOT EXISTS supabase_vault;

  -- Garantir que não existam jobs duplicados
  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'gsa-reconcile-pending-invoices';
  IF FOUND THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;

  -- Agendar o Job a cada 15 minutos
  PERFORM cron.schedule(
    'gsa-reconcile-pending-invoices',
    '*/15 * * * *',
    $CRON$
      DO $FUNC$
      DECLARE
        v_secret text;
        v_url text;
        v_request_id bigint;
      BEGIN
        -- O segredo x-cron-secret não fica hardcoded! Ele reside seguramente no vault do Supabase.
        SELECT secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1;
        
        -- A URL da edge function também pode variar por ambiente (local, staging, prod), 
        -- portanto lemos do vault ou usamos um fallback se o admin configurar na tabela de configs.
        SELECT secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'gsa_payments_url' LIMIT 1;
        
        IF v_secret IS NULL OR v_url IS NULL THEN
          RAISE LOG 'Reconciliacao abortada: cron_secret ou gsa_payments_url ausentes no vault.';
          RETURN;
        END IF;

        -- Disparar a Edge Function de pagamentos para iniciar o lote de reconciliação.
        -- O pg_net lida com a request de forma assíncrona.
        SELECT net.http_post(
            url := v_url,
            headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
            body := '{"action": "reconcile_invoices"}'::jsonb,
            timeout_milliseconds := 15000
        ) INTO v_request_id;
        
        RAISE LOG 'Reconciliacao disparada via pg_net (request_id: %)', v_request_id;
      END $FUNC$;
    $CRON$
  );
END $$;
