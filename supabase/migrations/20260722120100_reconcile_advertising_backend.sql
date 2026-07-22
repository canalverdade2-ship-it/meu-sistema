BEGIN;

-- O SQL de origem foi preservado em
-- 20260722040000_harden_advertising_backend.sql. O workflow protegido de
-- reconciliação o executa com fechamento transacional explícito e este arquivo
-- comprova o estado final sob uma versão única.
DO $$
BEGIN
  IF to_regclass('public.gsa_ad_rate_limit_buckets') IS NULL
     OR to_regclass('public.gsa_ad_maintenance_state') IS NULL THEN
    RAISE EXCEPTION 'Tabelas de hardening da publicidade ausentes';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'gsa_ad_proposals'
      AND column_name = 'accepted_version'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'gsa_ad_campaigns'
      AND column_name = 'served_count'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'gsa_ad_delivery_events'
      AND column_name = 'request_hash'
  ) THEN
    RAISE EXCEPTION 'Colunas obrigatórias do hardening da publicidade ausentes';
  END IF;

  IF to_regprocedure('public.gsa_ads_valid_cpf_cnpj(text)') IS NULL
     OR to_regprocedure('public.gsa_ads_route_matches(text,text)') IS NULL
     OR to_regprocedure('public.gsa_advertiser_accept_proposal(uuid)') IS NULL
     OR to_regprocedure('public.gsa_admin_update_ad_proposal_status(uuid,text,text)') IS NULL THEN
    RAISE EXCEPTION 'Funções obrigatórias do hardening da publicidade ausentes';
  END IF;
END $$;

COMMIT;
