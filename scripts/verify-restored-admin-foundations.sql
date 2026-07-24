DO $$
DECLARE
  v_required integer;
  v_restrictive integer;
  v_signature text;
BEGIN
  SELECT count(*)
    INTO v_required
    FROM supabase_migrations.schema_migrations
   WHERE version IN (
     '20260718121000',
     '20260720183000',
     '20260721194500',
     '20260721194600',
     '20260721194700',
     '20260721194800',
     '20260721194900',
     '20260724200000'
   );

  IF v_required <> 8 THEN
    RAISE EXCEPTION 'Histórico das fundações e da limpeza de Seguros incompleto: % de 8 migrations', v_required;
  END IF;

  IF to_regprocedure('public.gsa_admin_get_pendency_counts_secure(uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'RPC segura de pendências administrativas ausente';
  END IF;

  IF to_regprocedure('public.gsa_admin_search_clients(uuid,text,text,integer)') IS NULL THEN
    RAISE EXCEPTION 'Busca segura de clientes do administrativo ausente';
  END IF;

  IF to_regprocedure('public.gsa_admin_dashboard_snapshot_pre_ticket_compat(uuid,text)') IS NULL
     OR to_regprocedure('public.gsa_admin_dashboard_snapshot_pre_minimization(uuid,text)') IS NULL
     OR to_regprocedure('public.gsa_admin_dashboard_snapshot(uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'Cadeia do snapshot administrativo incompleta';
  END IF;

  FOREACH v_signature IN ARRAY ARRAY[
    'public.gsa_admin_travel_list(uuid,text,text,integer,integer,text)',
    'public.gsa_admin_travel_link_lead(uuid,text,uuid,uuid)',
    'public.gsa_admin_travel_update_status(uuid,text,text,uuid,text)',
    'public.gsa_admin_travel_create_proposal(uuid,text,uuid,text,numeric,integer,integer,integer,text)',
    'public.gsa_admin_travel_create_package(uuid,text,jsonb)'
  ] LOOP
    IF to_regprocedure(v_signature) IS NULL THEN
      RAISE EXCEPTION 'RPC administrativa de Viagens ausente: %', v_signature;
    END IF;
    IF has_function_privilege('anon', v_signature, 'EXECUTE')
       OR NOT has_function_privilege('authenticated', v_signature, 'EXECUTE') THEN
      RAISE EXCEPTION 'Privilégios incorretos na RPC administrativa de Viagens: %', v_signature;
    END IF;
  END LOOP;

  IF to_regclass('public.seguros_parceiros') IS NULL
     OR to_regclass('public.seguros_cotacoes') IS NULL
     OR to_regclass('public.seguros_propostas') IS NULL
     OR to_regclass('public.saude_parceiros') IS NULL
     OR to_regclass('public.saude_produtos') IS NULL
     OR to_regclass('public.saude_cotacoes') IS NULL
     OR to_regclass('public.saude_propostas') IS NULL
     OR to_regclass('public.saude_planos_publicos') IS NULL THEN
    RAISE EXCEPTION 'Catálogo do GSA Saúde não foi preservado ou estruturas operacionais estão incompletas';
  END IF;

  IF to_regclass('public.seguros_produtos') IS NOT NULL
     OR to_regclass('public.seguros_ofertas') IS NOT NULL
     OR to_regclass('public.seguros_ofertas_publicas') IS NOT NULL THEN
    RAISE EXCEPTION 'Estruturas obsoletas do catálogo de Seguros ainda existem';
  END IF;

  v_signature := 'public.gsa_client_seguros_criar_cotacao(uuid,text,jsonb,uuid)';
  IF to_regprocedure(v_signature) IS NULL THEN
    RAISE EXCEPTION 'RPC de cotação direta de Seguros ausente';
  END IF;
  IF has_function_privilege('anon', v_signature, 'EXECUTE')
     OR NOT has_function_privilege('authenticated', v_signature, 'EXECUTE') THEN
    RAISE EXCEPTION 'Privilégios incorretos na RPC de cotação direta de Seguros';
  END IF;

  IF public.gsa_admin_resource_config('saude_produtos') IS NULL THEN
    RAISE EXCEPTION 'Cadastro de produtos do GSA Saúde deixou de ser permitido';
  END IF;

  IF public.gsa_admin_resource_config('seguros_produtos') IS NOT NULL THEN
    RAISE EXCEPTION 'Catálogo de Seguros ainda exposto pela API administrativa';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name IN ('seguros_cotacoes', 'seguros_propostas', 'seguros_apolices')
       AND column_name IN ('produto_id', 'oferta_id')
  ) THEN
    RAISE EXCEPTION 'Referências obsoletas ao catálogo de Seguros ainda existem nas tabelas operacionais';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'saude_propostas'
       AND column_name = 'produto_id'
  ) THEN
    RAISE EXCEPTION 'Vínculo de produto das propostas do GSA Saúde não foi preservado';
  END IF;

  IF has_function_privilege('anon', 'public.gsa_admin_get_pendency_counts_secure(uuid,text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.gsa_admin_get_pendency_counts_secure(uuid,text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.gsa_admin_search_clients(uuid,text,text,integer)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.gsa_admin_search_clients(uuid,text,text,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Privilégios das RPCs administrativas restauradas estão incorretos';
  END IF;

  SELECT count(*)
    INTO v_restrictive
    FROM pg_policies
   WHERE schemaname = 'public'
     AND policyname LIKE 'gsa_collaborator_module_seguros_%'
     AND permissive = 'RESTRICTIVE';

  IF v_restrictive < 16 THEN
    RAISE EXCEPTION 'Fronteiras restritivas operacionais de Seguros incompletas: % de 16', v_restrictive;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'seguros_cotacoes'
       AND column_name = 'idempotency_key'
  ) THEN
    RAISE EXCEPTION 'Cotação direta de Seguros sem proteção de idempotência';
  END IF;
END $$;

SELECT 'RESTORED_ADMIN_FOUNDATIONS_VERIFIED' AS result;
