DO $$
DECLARE
  v_sessao_id uuid;
  v_token text;
  v_cliente_id uuid := gen_random_uuid();
  v_fatura_id uuid := gen_random_uuid();
  v_cobranca_id uuid := gen_random_uuid();
  v_result jsonb;
  v_status text;
  v_count integer;
  v_suffix text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
  v_codigo_ref text := 'TEST-AGR-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
BEGIN
  SELECT sessao_id, session_token
    INTO v_sessao_id, v_token
  FROM public.gsa_start_session(
    'admin',
    '00000000-0000-0000-0000-000000000000',
    'Validador Acordo Cobranca',
    '{"source":"validate_secure_admin_collection_agreement"}'::jsonb
  );

  INSERT INTO public.clientes(
    id, codigo_cliente, nome, cpf, telefone, status,
    saldo_carteira, saldo_pontos, pin_tentativas, pin_bloqueado,
    limite_credito_total, limite_credito_disponivel, opcao_pagamento_parcelado
  )
  VALUES (
    v_cliente_id,
    'TEST-AGR-' || v_suffix,
    'Cliente Teste Acordo',
    '906' || substr(v_suffix, 1, 8),
    '11906' || substr(v_suffix, 1, 6),
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
  VALUES (
    v_fatura_id,
    v_codigo_ref,
    v_cliente_id,
    300,
    0,
    300,
    'vencida',
    current_date - 10,
    current_date - 20,
    'Fatura original teste acordo'
  );

  INSERT INTO public.cobrancas(
    id, fatura_id, cliente_id, valor_original, valor_atualizado,
    valor_pago, status, nivel_cobranca, score_risco
  )
  VALUES (
    v_cobranca_id,
    v_fatura_id,
    v_cliente_id,
    300,
    300,
    0,
    'pendente',
    1,
    15
  );

  SELECT public.gsa_admin_gerar_acordo_cobranca(
    v_sessao_id,
    v_token,
    v_cobranca_id,
    3,
    current_date + 5,
    0,
    'fixo',
    'Teste automatizado'
  )
    INTO v_result;

  IF NOT coalesce((v_result->>'success')::boolean, false) THEN
    RAISE EXCEPTION 'Falha ao gerar acordo: %', v_result;
  END IF;

  SELECT status INTO v_status FROM public.cobrancas WHERE id = v_cobranca_id;
  IF v_status <> 'acordo' THEN
    RAISE EXCEPTION 'Cobranca nao ficou em acordo. status=%', v_status;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.cobranca_acordo_parcelas
  WHERE cobranca_id = v_cobranca_id
    AND status = 'pendente';

  IF v_count <> 3 THEN
    RAISE EXCEPTION 'Parcelas nao foram criadas. count=%', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.faturas
  WHERE cliente_id = v_cliente_id
    AND observacoes ILIKE ('%' || v_codigo_ref || '%')
    AND status = 'pendente';

  IF v_count <> 3 THEN
    RAISE EXCEPTION 'Faturas de parcelas nao foram criadas. count=%', v_count;
  END IF;

  SELECT public.gsa_admin_gerar_acordo_cobranca(
    v_sessao_id,
    v_token,
    v_cobranca_id,
    3,
    current_date + 5,
    0,
    'fixo',
    'Teste automatizado'
  )
    INTO v_result;

  IF NOT coalesce((v_result->>'success')::boolean, false)
     OR NOT coalesce((v_result->>'already_processed')::boolean, false) THEN
    RAISE EXCEPTION 'Idempotencia de acordo falhou: %', v_result;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.cobranca_acordo_parcelas
  WHERE cobranca_id = v_cobranca_id
    AND status = 'pendente';

  IF v_count <> 3 THEN
    RAISE EXCEPTION 'Acordo duplicou parcelas. count=%', v_count;
  END IF;

  SELECT public.gsa_admin_cancelar_acordo_cobranca(v_sessao_id, v_token, v_cobranca_id)
    INTO v_result;

  IF NOT coalesce((v_result->>'success')::boolean, false) THEN
    RAISE EXCEPTION 'Falha ao cancelar acordo: %', v_result;
  END IF;

  SELECT status INTO v_status FROM public.cobrancas WHERE id = v_cobranca_id;
  IF v_status <> 'pendente' THEN
    RAISE EXCEPTION 'Cobranca nao voltou a pendente. status=%', v_status;
  END IF;

  SELECT status INTO v_status FROM public.faturas WHERE id = v_fatura_id;
  IF v_status <> 'vencida' THEN
    RAISE EXCEPTION 'Fatura original nao foi reativada. status=%', v_status;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.cobranca_acordo_parcelas
  WHERE cobranca_id = v_cobranca_id
    AND status = 'pendente';

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Parcelas pendentes permaneceram apos cancelamento. count=%', v_count;
  END IF;

  DELETE FROM public.cobranca_historico WHERE cobranca_id = v_cobranca_id;
  DELETE FROM public.cobranca_acordo_parcelas WHERE cobranca_id = v_cobranca_id;
  DELETE FROM public.cobrancas WHERE id = v_cobranca_id;
  DELETE FROM public.faturas WHERE cliente_id = v_cliente_id;
  DELETE FROM public.clientes WHERE id = v_cliente_id;
  PERFORM public.gsa_end_session(v_sessao_id, v_token);
  DELETE FROM public.sistema_sessoes WHERE id = v_sessao_id;
END;
$$;
