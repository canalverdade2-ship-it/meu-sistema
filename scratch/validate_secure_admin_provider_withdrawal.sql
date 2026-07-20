DO $$
DECLARE
  v_sessao_id uuid;
  v_token text;
  v_prestador_id uuid := gen_random_uuid();
  v_saque_aprovar_id uuid := gen_random_uuid();
  v_saque_rejeitar_id uuid := gen_random_uuid();
  v_result jsonb;
  v_status text;
  v_count integer;
  v_suffix text := lpad(floor(random() * 100000000)::int::text, 8, '0');
BEGIN
  SELECT sessao_id, session_token
    INTO v_sessao_id, v_token
  FROM public.gsa_start_session(
    'admin',
    '00000000-0000-0000-0000-000000000000',
    'Validador Saque Prestador',
    '{"source":"validate_secure_admin_provider_withdrawal"}'::jsonb
  );

  INSERT INTO public.prestadores(
    id, tipo_cadastro, nome_razao, documento, email, telefone, status
  )
  VALUES (
    v_prestador_id,
    'cpf',
    'Prestador Teste Saque',
    '918' || substr(v_suffix, 1, 8),
    'prestador-' || v_suffix || '@teste.local',
    '11918' || substr(v_suffix, 1, 6),
    'ativo'
  );

  INSERT INTO public.prestador_saques(id, prestador_id, valor, status, dados_bancarios)
  VALUES
    (v_saque_aprovar_id, v_prestador_id, 100, 'pendente', '{}'::jsonb),
    (v_saque_rejeitar_id, v_prestador_id, 200, 'pendente', '{}'::jsonb);

  SELECT public.gsa_admin_processar_saque_prestador(v_sessao_id, v_token, v_saque_aprovar_id, 'aprovar', NULL, current_date)
    INTO v_result;

  SELECT status INTO v_status FROM public.prestador_saques WHERE id = v_saque_aprovar_id;
  IF v_status <> 'pago' THEN RAISE EXCEPTION 'Aprovacao de saque inconsistente. status=%', v_status; END IF;

  SELECT public.gsa_admin_processar_saque_prestador(v_sessao_id, v_token, v_saque_aprovar_id, 'aprovar', NULL, current_date)
    INTO v_result;
  IF NOT coalesce((v_result->>'already_processed')::boolean, false) THEN
    RAISE EXCEPTION 'Segundo clique de aprovacao deveria retornar already_processed.';
  END IF;

  SELECT public.gsa_admin_processar_saque_prestador(v_sessao_id, v_token, v_saque_rejeitar_id, 'rejeitar', 'Dados invalidos', NULL)
    INTO v_result;

  SELECT status INTO v_status FROM public.prestador_saques WHERE id = v_saque_rejeitar_id;
  IF v_status <> 'cancelado' THEN RAISE EXCEPTION 'Rejeicao de saque inconsistente. status=%', v_status; END IF;

  SELECT count(*) INTO v_count
  FROM public.prestador_transacoes
  WHERE prestador_id = v_prestador_id
    AND tipo = 'credito'
    AND valor = 200;

  IF v_count <> 1 THEN RAISE EXCEPTION 'Estorno de rejeicao inconsistente. count=%', v_count; END IF;

  SELECT public.gsa_admin_processar_saque_prestador(v_sessao_id, v_token, v_saque_rejeitar_id, 'rejeitar', 'Dados invalidos', NULL)
    INTO v_result;
  IF NOT coalesce((v_result->>'already_processed')::boolean, false) THEN
    RAISE EXCEPTION 'Segundo clique de rejeicao deveria retornar already_processed.';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.prestador_transacoes
  WHERE prestador_id = v_prestador_id
    AND tipo = 'credito'
    AND valor = 200;

  IF v_count <> 1 THEN RAISE EXCEPTION 'Segundo clique duplicou estorno. count=%', v_count; END IF;

  DELETE FROM public.prestador_transacoes WHERE prestador_id = v_prestador_id;
  DELETE FROM public.prestador_saques WHERE prestador_id = v_prestador_id;
  DELETE FROM public.prestadores WHERE id = v_prestador_id;
  PERFORM public.gsa_end_session(v_sessao_id, v_token);
  DELETE FROM public.sistema_sessoes WHERE id = v_sessao_id;
END;
$$;
