DO $$
DECLARE
  v_sessao_id uuid;
  v_token text;
  v_cliente_id uuid := gen_random_uuid();
  v_fatura_original_id uuid := gen_random_uuid();
  v_fatura_filha_id uuid := gen_random_uuid();
  v_cobranca_id uuid := gen_random_uuid();
  v_parcela_id uuid := gen_random_uuid();
  v_result jsonb;
  v_protesto_id uuid;
  v_status text;
  v_count integer;
  v_suffix text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
  v_codigo_ref text := 'TEST-PRO-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
BEGIN
  SELECT sessao_id, session_token
    INTO v_sessao_id, v_token
  FROM public.gsa_start_session(
    'admin',
    '00000000-0000-0000-0000-000000000000',
    'Validador Protesto Cobranca',
    '{"source":"validate_secure_admin_collection_protest"}'::jsonb
  );

  INSERT INTO public.clientes(
    id, codigo_cliente, nome, cpf, telefone, status,
    saldo_carteira, saldo_pontos, pin_tentativas, pin_bloqueado,
    limite_credito_total, limite_credito_disponivel, opcao_pagamento_parcelado
  )
  VALUES (
    v_cliente_id,
    'TEST-PRO-' || v_suffix,
    'Cliente Teste Protesto',
    '905' || substr(v_suffix, 1, 8),
    '11905' || substr(v_suffix, 1, 6),
    'ativo',
    0,
    0,
    0,
    false,
    0,
    0,
    false
  );

  INSERT INTO public.faturas(
    id, codigo_fatura, cliente_id, valor_total, valor_pago,
    valor_final_pendente, status, data_vencimento, data_emissao, observacoes
  )
  VALUES
    (
      v_fatura_original_id,
      v_codigo_ref,
      v_cliente_id,
      444,
      0,
      444,
      'vencida',
      current_date - 20,
      current_date - 30,
      'Fatura original teste protesto'
    ),
    (
      v_fatura_filha_id,
      'TEST-PRO-FILHA-' || v_suffix,
      v_cliente_id,
      148,
      0,
      148,
      'pendente',
      current_date + 5,
      current_date,
      'Parcela 1/3 do acordo ref ' || v_codigo_ref
    );

  INSERT INTO public.cobrancas(
    id, fatura_id, cliente_id, valor_original, valor_atualizado,
    valor_pago, status, nivel_cobranca, score_risco
  )
  VALUES (
    v_cobranca_id,
    v_fatura_original_id,
    v_cliente_id,
    444,
    444,
    0,
    'acordo',
    2,
    20
  );

  INSERT INTO public.cobranca_acordo_parcelas(
    id, cobranca_id, numero_parcela, valor_parcela, data_vencimento, status
  )
  VALUES (
    v_parcela_id,
    v_cobranca_id,
    1,
    148,
    current_date + 5,
    'pendente'
  );

  SELECT public.gsa_admin_protestar_cobranca(
    v_sessao_id,
    v_token,
    v_cobranca_id,
    current_date,
    'Cartorio Teste'
  )
    INTO v_result;

  IF NOT coalesce((v_result->>'success')::boolean, false) THEN
    RAISE EXCEPTION 'Falha ao protestar cobranca: %', v_result;
  END IF;

  v_protesto_id := (v_result->>'fatura_id')::uuid;

  SELECT status INTO v_status FROM public.cobrancas WHERE id = v_cobranca_id;
  IF v_status <> 'protestado' THEN
    RAISE EXCEPTION 'Cobranca nao ficou protestada. status=%', v_status;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.faturas
  WHERE id IN (v_fatura_original_id, v_fatura_filha_id)
    AND status = 'cancelado';

  IF v_count <> 2 THEN
    RAISE EXCEPTION 'Faturas antigas nao foram canceladas. count=%', v_count;
  END IF;

  SELECT status INTO v_status FROM public.cobranca_acordo_parcelas WHERE id = v_parcela_id;
  IF v_status <> 'cancelado' THEN
    RAISE EXCEPTION 'Parcela antiga nao foi cancelada. status=%', v_status;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.faturas
  WHERE id = v_protesto_id
    AND status = 'protestado'
    AND valor_total = 444;

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Fatura protesto nao foi criada corretamente. count=%', v_count;
  END IF;

  SELECT public.gsa_admin_protestar_cobranca(
    v_sessao_id,
    v_token,
    v_cobranca_id,
    current_date,
    'Cartorio Teste'
  )
    INTO v_result;

  IF NOT coalesce((v_result->>'success')::boolean, false)
     OR NOT coalesce((v_result->>'already_processed')::boolean, false) THEN
    RAISE EXCEPTION 'Idempotencia de protesto falhou: %', v_result;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.faturas
  WHERE cliente_id = v_cliente_id
    AND status = 'protestado'
    AND valor_total = 444;

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Protesto duplicou fatura. count=%', v_count;
  END IF;

  DELETE FROM public.cobranca_historico WHERE cobranca_id = v_cobranca_id;
  DELETE FROM public.cobranca_acordo_parcelas WHERE id = v_parcela_id;
  DELETE FROM public.cobrancas WHERE id = v_cobranca_id;
  DELETE FROM public.faturas WHERE id IN (v_fatura_original_id, v_fatura_filha_id, v_protesto_id);
  DELETE FROM public.clientes WHERE id = v_cliente_id;
  PERFORM public.gsa_end_session(v_sessao_id, v_token);
  DELETE FROM public.sistema_sessoes WHERE id = v_sessao_id;
END;
$$;
