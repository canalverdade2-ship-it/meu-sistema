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
  v_status text;
  v_valor_pago numeric;
  v_pagamentos integer;
  v_history_count integer;
  v_suffix text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
BEGIN
  SELECT sessao_id, session_token
    INTO v_sessao_id, v_token
  FROM public.gsa_start_session(
    'admin',
    '00000000-0000-0000-0000-000000000000',
    'Validador Baixa Cobranca',
    '{"source":"validate_secure_admin_collection_payment"}'::jsonb
  );

  INSERT INTO public.clientes(
    id, codigo_cliente, nome, cpf, telefone, status,
    saldo_carteira, saldo_pontos, pin_tentativas, pin_bloqueado,
    limite_credito_total, limite_credito_disponivel, opcao_pagamento_parcelado
  )
  VALUES (
    v_cliente_id,
    'TEST-COB-PAY-' || v_suffix,
    'Cliente Teste Baixa Cobranca',
    '904' || substr(v_suffix, 1, 8),
    '11904' || substr(v_suffix, 1, 6),
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
      'TEST-COB-PAY-' || v_suffix,
      v_cliente_id,
      300,
      0,
      300,
      'vencida',
      current_date - 10,
      current_date - 20,
      'Fatura original teste cobranca'
    ),
    (
      v_fatura_filha_id,
      'TEST-COB-PARC-' || v_suffix,
      v_cliente_id,
      100,
      0,
      100,
      'pendente',
      current_date + 5,
      current_date,
      'Parcela 1/3 do acordo TESTE'
    );

  INSERT INTO public.cobrancas(
    id, fatura_id, cliente_id, valor_original, valor_atualizado,
    valor_pago, status, nivel_cobranca, score_risco
  )
  VALUES (
    v_cobranca_id,
    v_fatura_original_id,
    v_cliente_id,
    300,
    300,
    0,
    'acordo',
    1,
    15
  );

  INSERT INTO public.cobranca_acordo_parcelas(
    id, cobranca_id, numero_parcela, valor_parcela, data_vencimento, status
  )
  VALUES (
    v_parcela_id,
    v_cobranca_id,
    1,
    100,
    current_date + 5,
    'pendente'
  );

  SELECT public.gsa_admin_baixar_parcela_cobranca(
    v_sessao_id,
    v_token,
    v_parcela_id,
    current_date,
    'pix'
  )
    INTO v_result;

  IF NOT coalesce((v_result->>'success')::boolean, false) THEN
    RAISE EXCEPTION 'Falha ao baixar parcela: %', v_result;
  END IF;

  SELECT status INTO v_status FROM public.cobranca_acordo_parcelas WHERE id = v_parcela_id;
  SELECT valor_pago INTO v_valor_pago FROM public.cobrancas WHERE id = v_cobranca_id;
  SELECT count(*) INTO v_pagamentos FROM public.pagamentos WHERE fatura_id = v_fatura_filha_id;

  IF v_status <> 'pago' OR v_valor_pago <> 100 OR v_pagamentos <> 1 THEN
    RAISE EXCEPTION 'Baixa parcela inconsistente. status=%, valor_pago=%, pagamentos=%', v_status, v_valor_pago, v_pagamentos;
  END IF;

  SELECT public.gsa_admin_baixar_parcela_cobranca(
    v_sessao_id,
    v_token,
    v_parcela_id,
    current_date,
    'pix'
  )
    INTO v_result;

  IF NOT coalesce((v_result->>'success')::boolean, false)
     OR NOT coalesce((v_result->>'already_processed')::boolean, false) THEN
    RAISE EXCEPTION 'Idempotencia de parcela falhou: %', v_result;
  END IF;

  SELECT valor_pago INTO v_valor_pago FROM public.cobrancas WHERE id = v_cobranca_id;
  SELECT count(*) INTO v_pagamentos FROM public.pagamentos WHERE fatura_id = v_fatura_filha_id;

  IF v_valor_pago <> 100 OR v_pagamentos <> 1 THEN
    RAISE EXCEPTION 'Baixa parcela duplicou efeito. valor_pago=%, pagamentos=%', v_valor_pago, v_pagamentos;
  END IF;

  UPDATE public.cobrancas
     SET status = 'pendente', valor_pago = 0
   WHERE id = v_cobranca_id;

  SELECT public.gsa_admin_baixar_cobranca_manual(
    v_sessao_id,
    v_token,
    v_cobranca_id,
    300,
    current_date,
    'dinheiro'
  )
    INTO v_result;

  IF NOT coalesce((v_result->>'success')::boolean, false) THEN
    RAISE EXCEPTION 'Falha ao baixar cobranca manual: %', v_result;
  END IF;

  SELECT status, valor_pago INTO v_status, v_valor_pago FROM public.cobrancas WHERE id = v_cobranca_id;
  SELECT count(*) INTO v_history_count FROM public.cobranca_historico WHERE cobranca_id = v_cobranca_id;

  IF v_status <> 'quitado' OR v_valor_pago <> 300 OR v_history_count < 2 THEN
    RAISE EXCEPTION 'Baixa manual inconsistente. status=%, valor_pago=%, historicos=%', v_status, v_valor_pago, v_history_count;
  END IF;

  SELECT public.gsa_admin_baixar_cobranca_manual(
    v_sessao_id,
    v_token,
    v_cobranca_id,
    300,
    current_date,
    'dinheiro'
  )
    INTO v_result;

  IF NOT coalesce((v_result->>'success')::boolean, false)
     OR NOT coalesce((v_result->>'already_processed')::boolean, false) THEN
    RAISE EXCEPTION 'Idempotencia de cobranca manual falhou: %', v_result;
  END IF;

  DELETE FROM public.pagamentos WHERE fatura_id IN (v_fatura_original_id, v_fatura_filha_id);
  DELETE FROM public.cobranca_historico WHERE cobranca_id = v_cobranca_id;
  DELETE FROM public.cobranca_acordo_parcelas WHERE id = v_parcela_id;
  DELETE FROM public.cobrancas WHERE id = v_cobranca_id;
  DELETE FROM public.faturas WHERE id IN (v_fatura_original_id, v_fatura_filha_id);
  DELETE FROM public.clientes WHERE id = v_cliente_id;
  PERFORM public.gsa_end_session(v_sessao_id, v_token);
  DELETE FROM public.sistema_sessoes WHERE id = v_sessao_id;
END;
$$;
