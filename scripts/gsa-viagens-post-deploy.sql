-- Verificação pós-implantação do GSA Viagens.
-- Qualquer ausência interrompe o workflow com erro.

DO $$
DECLARE
  v_missing_tables TEXT;
  v_missing_functions TEXT;
  v_missing_buckets TEXT;
  v_missing_policies TEXT;
  v_rls_disabled TEXT;
BEGIN
  SELECT string_agg(expected.name, ', ' ORDER BY expected.name)
    INTO v_missing_tables
  FROM (
    VALUES
      ('viagens_configuracoes'),
      ('viagens_fornecedores'),
      ('viagens_pacotes'),
      ('viagens_pacote_imagens'),
      ('viagens_orcamentos'),
      ('viagens_solicitacoes_reserva'),
      ('viagens_propostas'),
      ('viagens_passageiros'),
      ('viagens_passageiro_documentos'),
      ('viagens_transacoes'),
      ('viagens_vouchers'),
      ('viagens_cancelamentos')
  ) AS expected(name)
  WHERE to_regclass(format('public.%I', expected.name)) IS NULL;

  IF v_missing_tables IS NOT NULL THEN
    RAISE EXCEPTION 'Tabelas ausentes após implantação: %', v_missing_tables;
  END IF;

  SELECT string_agg(expected.signature, ', ' ORDER BY expected.signature)
    INTO v_missing_functions
  FROM (
    VALUES
      ('public.gsa_accept_travel_proposal(uuid,text,uuid)'),
      ('public.gsa_client_checkout_travel(uuid,text,jsonb)'),
      ('public.gsa_request_travel_cancellation(uuid,text,uuid,text)')
  ) AS expected(signature)
  WHERE to_regprocedure(expected.signature) IS NULL;

  IF v_missing_functions IS NOT NULL THEN
    RAISE EXCEPTION 'RPCs ausentes após implantação: %', v_missing_functions;
  END IF;

  SELECT string_agg(expected.name, ', ' ORDER BY expected.name)
    INTO v_missing_buckets
  FROM (
    VALUES ('viagens-documentos'), ('viagens-vouchers')
  ) AS expected(name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM storage.buckets bucket
    WHERE bucket.id = expected.name
      AND bucket.public = false
  );

  IF v_missing_buckets IS NOT NULL THEN
    RAISE EXCEPTION 'Buckets privados ausentes ou públicos: %', v_missing_buckets;
  END IF;

  SELECT string_agg(expected.policy_name, ', ' ORDER BY expected.policy_name)
    INTO v_missing_policies
  FROM (
    VALUES
      ('viagens_orcamentos', 'Cliente ou visitante insere orcamentos'),
      ('viagens_propostas', 'Cliente ve suas propostas'),
      ('viagens_passageiros', 'Cliente ve seus passageiros'),
      ('viagens_transacoes', 'Cliente ve suas transacoes'),
      ('viagens_cancelamentos', 'Cliente ve seus cancelamentos'),
      ('storage.objects', 'Cliente envia documentos de viagem'),
      ('storage.objects', 'Cliente baixa vouchers de viagem')
  ) AS expected(target, policy_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_policies policy
    WHERE format('%I.%I', policy.schemaname, policy.tablename) = expected.target
      AND policy.policyname = expected.policy_name
  );

  IF v_missing_policies IS NOT NULL THEN
    RAISE EXCEPTION 'Políticas ausentes após implantação: %', v_missing_policies;
  END IF;

  SELECT string_agg(class.relname, ', ' ORDER BY class.relname)
    INTO v_rls_disabled
  FROM pg_class class
  JOIN pg_namespace namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'public'
    AND class.relname IN (
      'viagens_configuracoes',
      'viagens_fornecedores',
      'viagens_pacotes',
      'viagens_pacote_imagens',
      'viagens_orcamentos',
      'viagens_solicitacoes_reserva',
      'viagens_propostas',
      'viagens_passageiros',
      'viagens_passageiro_documentos',
      'viagens_transacoes',
      'viagens_vouchers',
      'viagens_cancelamentos'
    )
    AND class.relrowsecurity = false;

  IF v_rls_disabled IS NOT NULL THEN
    RAISE EXCEPTION 'RLS desabilitado nas tabelas: %', v_rls_disabled;
  END IF;
END;
$$;

SELECT
  'gsa_viagens' AS module,
  12 AS expected_tables,
  (
    SELECT count(*)
    FROM pg_class class
    JOIN pg_namespace namespace ON namespace.oid = class.relnamespace
    WHERE namespace.nspname = 'public'
      AND class.relname LIKE 'viagens_%'
      AND class.relkind = 'r'
  ) AS travel_tables_found,
  (
    SELECT count(*)
    FROM storage.buckets
    WHERE id IN ('viagens-documentos', 'viagens-vouchers')
      AND public = false
  ) AS private_buckets_found,
  (
    SELECT count(*)
    FROM pg_policies
    WHERE (schemaname = 'public' AND tablename LIKE 'viagens_%')
       OR (schemaname = 'storage' AND tablename = 'objects' AND policyname ILIKE '%viagem%')
  ) AS travel_policies_found,
  to_regprocedure('public.gsa_accept_travel_proposal(uuid,text,uuid)') IS NOT NULL AS accept_rpc_ready,
  to_regprocedure('public.gsa_client_checkout_travel(uuid,text,jsonb)') IS NOT NULL AS checkout_rpc_ready,
  to_regprocedure('public.gsa_request_travel_cancellation(uuid,text,uuid,text)') IS NOT NULL AS cancellation_rpc_ready;
