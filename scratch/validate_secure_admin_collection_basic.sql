DO $$
DECLARE
  v_sessao_id uuid;
  v_token text;
  v_cliente_id uuid := gen_random_uuid();
  v_fatura_id uuid := gen_random_uuid();
  v_cobranca_id uuid;
  v_result jsonb;
  v_status text;
  v_nivel integer;
  v_history_count integer;
  v_last_contact timestamptz;
  v_suffix text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
BEGIN
  SELECT sessao_id, session_token
    INTO v_sessao_id, v_token
  FROM public.gsa_start_session(
    'admin',
    '00000000-0000-0000-0000-000000000000',
    'Validador Cobranca Basica',
    '{"source":"validate_secure_admin_collection_basic"}'::jsonb
  );

  INSERT INTO public.clientes(
    id, codigo_cliente, nome, cpf, telefone, status,
    saldo_carteira, saldo_pontos, pin_tentativas, pin_bloqueado,
    limite_credito_total, limite_credito_disponivel, opcao_pagamento_parcelado
  )
  VALUES (
    v_cliente_id,
    'TEST-COB-' || v_suffix,
    'Cliente Teste Cobranca',
    '903' || substr(v_suffix, 1, 8),
    '11903' || substr(v_suffix, 1, 6),
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
    valor_final_pendente, status, data_vencimento, data_emissao
  )
  VALUES (
    v_fatura_id,
    'TEST-COB-' || v_suffix,
    v_cliente_id,
    222.22,
    0,
    222.22,
    'vencida',
    current_date - 5,
    current_date - 15
  );

  SELECT public.gsa_admin_criar_cobranca_fatura(v_sessao_id, v_token, v_fatura_id)
    INTO v_result;

  IF NOT coalesce((v_result->>'success')::boolean, false) THEN
    RAISE EXCEPTION 'Falha ao criar cobranca: %', v_result;
  END IF;

  v_cobranca_id := (v_result->>'cobranca_id')::uuid;

  SELECT count(*) INTO v_history_count
  FROM public.cobranca_historico
  WHERE cobranca_id = v_cobranca_id;

  IF v_history_count <> 1 THEN
    RAISE EXCEPTION 'Historico inicial inconsistente. count=%', v_history_count;
  END IF;

  SELECT public.gsa_admin_criar_cobranca_fatura(v_sessao_id, v_token, v_fatura_id)
    INTO v_result;

  IF NOT coalesce((v_result->>'success')::boolean, false)
     OR NOT coalesce((v_result->>'already_exists')::boolean, false) THEN
    RAISE EXCEPTION 'Idempotencia de cobranca falhou: %', v_result;
  END IF;

  IF (SELECT count(*) FROM public.cobrancas WHERE fatura_id = v_fatura_id) <> 1 THEN
    RAISE EXCEPTION 'Cobranca duplicada criada para fatura %', v_fatura_id;
  END IF;

  SELECT public.gsa_admin_registrar_cobranca_historico(
    v_sessao_id,
    v_token,
    v_cobranca_id,
    'contato_whatsapp',
    'Teste de contato automatizado',
    'whatsapp',
    false,
    null,
    null,
    true
  )
    INTO v_result;

  IF NOT coalesce((v_result->>'success')::boolean, false) THEN
    RAISE EXCEPTION 'Falha ao registrar historico: %', v_result;
  END IF;

  SELECT data_ultimo_contato INTO v_last_contact
  FROM public.cobrancas
  WHERE id = v_cobranca_id;

  IF v_last_contact IS NULL THEN
    RAISE EXCEPTION 'data_ultimo_contato nao foi atualizada.';
  END IF;

  SELECT public.gsa_admin_mudar_status_cobranca(
    v_sessao_id,
    v_token,
    v_cobranca_id,
    'em_cobranca',
    2
  )
    INTO v_result;

  IF NOT coalesce((v_result->>'success')::boolean, false) THEN
    RAISE EXCEPTION 'Falha ao mudar status: %', v_result;
  END IF;

  SELECT status, nivel_cobranca
    INTO v_status, v_nivel
  FROM public.cobrancas
  WHERE id = v_cobranca_id;

  IF v_status <> 'em_cobranca' OR v_nivel <> 2 THEN
    RAISE EXCEPTION 'Status inconsistente. status=%, nivel=%', v_status, v_nivel;
  END IF;

  SELECT count(*) INTO v_history_count
  FROM public.cobranca_historico
  WHERE cobranca_id = v_cobranca_id;

  IF v_history_count <> 3 THEN
    RAISE EXCEPTION 'Historico final inconsistente. count=%', v_history_count;
  END IF;

  DELETE FROM public.cobranca_historico WHERE cobranca_id = v_cobranca_id;
  DELETE FROM public.cobrancas WHERE id = v_cobranca_id;
  DELETE FROM public.faturas WHERE id = v_fatura_id;
  DELETE FROM public.clientes WHERE id = v_cliente_id;
  PERFORM public.gsa_end_session(v_sessao_id, v_token);
  DELETE FROM public.sistema_sessoes WHERE id = v_sessao_id;
END;
$$;
