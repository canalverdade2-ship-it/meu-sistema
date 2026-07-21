DO $$
DECLARE
  v_required integer;
  v_restrictive integer;
BEGIN
  SELECT count(*)
    INTO v_required
    FROM supabase_migrations.schema_migrations
   WHERE version IN (
     '20260718121000',
     '20260720183000',
     '20260721194500',
     '20260721194600',
     '20260721194700'
   );

  IF v_required <> 5 THEN
    RAISE EXCEPTION 'Histórico da recuperação incompleto: % de 5 migrations', v_required;
  END IF;

  IF to_regprocedure('public.gsa_admin_get_pendency_counts_secure(uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'RPC segura de pendências administrativas ausente';
  END IF;

  IF to_regprocedure('public.gsa_admin_dashboard_snapshot_pre_ticket_compat(uuid,text)') IS NULL
     OR to_regprocedure('public.gsa_admin_dashboard_snapshot_pre_minimization(uuid,text)') IS NULL
     OR to_regprocedure('public.gsa_admin_dashboard_snapshot(uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'Cadeia do snapshot administrativo incompleta';
  END IF;

  IF to_regclass('public.seguros_parceiros') IS NULL
     OR to_regclass('public.seguros_produtos') IS NULL
     OR to_regclass('public.seguros_cotacoes') IS NULL
     OR to_regclass('public.seguros_propostas') IS NULL
     OR to_regclass('public.seguros_ofertas_publicas') IS NULL THEN
    RAISE EXCEPTION 'Estrutura pública ou operacional do GSA Seguros incompleta';
  END IF;

  IF NOT has_table_privilege('anon', 'public.seguros_ofertas_publicas', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.seguros_ofertas_publicas', 'SELECT') THEN
    RAISE EXCEPTION 'View pública de Seguros sem permissões de leitura';
  END IF;

  IF has_function_privilege('anon', 'public.gsa_admin_get_pendency_counts_secure(uuid,text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.gsa_admin_get_pendency_counts_secure(uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Privilégios da RPC administrativa de pendências estão incorretos';
  END IF;

  SELECT count(*)
    INTO v_restrictive
    FROM pg_policies
   WHERE schemaname = 'public'
     AND policyname LIKE 'gsa_collaborator_module_seguros_%'
     AND permissive = 'RESTRICTIVE';

  IF v_restrictive < 18 THEN
    RAISE EXCEPTION 'Fronteiras restritivas de Seguros incompletas: % de 18', v_restrictive;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'seguros_cotacoes'
       AND column_name = 'idempotency_key'
  ) OR NOT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'seguros_propostas'
       AND column_name = 'coberturas'
  ) THEN
    RAISE EXCEPTION 'Tabelas parciais de Seguros não foram integralmente atualizadas';
  END IF;
END $$;

SELECT 'RESTORED_ADMIN_FOUNDATIONS_VERIFIED' AS result;
