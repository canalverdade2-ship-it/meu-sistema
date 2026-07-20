DO $$
DECLARE
  v_sessao_id uuid;
  v_token text;
  v_cliente_id uuid := gen_random_uuid();
  v_fatura_id uuid := gen_random_uuid();
  v_result jsonb;
  v_status text;
  v_pagamentos integer;
  v_suffix text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
BEGIN
  SELECT sessao_id, session_token
    INTO v_sessao_id, v_token
  FROM public.gsa_start_session(
    'admin',
    '00000000-0000-0000-0000-000000000000',
    'Validador Baixa Fatura',
    '{"source":"validate_secure_admin_invoice_payment"}'::jsonb
  );

  INSERT INTO public.clientes(
    id, codigo_cliente, nome, cpf, telefone, status,
    saldo_carteira, saldo_pontos, pin_tentativas, pin_bloqueado,
    limite_credito_total, limite_credito_disponivel, opcao_pagamento_parcelado
  )
  VALUES (
    v_cliente_id,
    'TEST-FAT-' || v_suffix,
    'Cliente Teste Baixa Fatura',
    '902' || substr(v_suffix, 1, 8),
    '11902' || substr(v_suffix, 1, 6),
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
    'TEST-FAT-' || v_suffix,
    v_cliente_id,
    123.45,
    0,
    123.45,
    'pendente',
    current_date + 7,
    current_date
  );

  SELECT public.gsa_admin_baixar_fatura(
    v_sessao_id,
    v_token,
    v_fatura_id,
    'pix',
    now(),
    'Teste automatizado de baixa'
  )
    INTO v_result;

  IF NOT coalesce((v_result->>'success')::boolean, false) THEN
    RAISE EXCEPTION 'Falha ao baixar fatura: %', v_result;
  END IF;

  SELECT status INTO v_status FROM public.faturas WHERE id = v_fatura_id;
  SELECT count(*) INTO v_pagamentos FROM public.pagamentos WHERE fatura_id = v_fatura_id;

  IF v_status <> 'pago' OR v_pagamentos <> 1 THEN
    RAISE EXCEPTION 'Baixa inconsistente. status=%, pagamentos=%', v_status, v_pagamentos;
  END IF;

  SELECT public.gsa_admin_baixar_fatura(
    v_sessao_id,
    v_token,
    v_fatura_id,
    'pix',
    now(),
    'Teste duplicado'
  )
    INTO v_result;

  IF NOT coalesce((v_result->>'success')::boolean, false)
     OR NOT coalesce((v_result->>'already_processed')::boolean, false) THEN
    RAISE EXCEPTION 'Idempotencia falhou: %', v_result;
  END IF;

  SELECT count(*) INTO v_pagamentos FROM public.pagamentos WHERE fatura_id = v_fatura_id;
  IF v_pagamentos <> 1 THEN
    RAISE EXCEPTION 'Pagamento duplicado criado. pagamentos=%', v_pagamentos;
  END IF;

  DELETE FROM public.pagamentos WHERE fatura_id = v_fatura_id;
  DELETE FROM public.faturas WHERE id = v_fatura_id;
  DELETE FROM public.clientes WHERE id = v_cliente_id;
  PERFORM public.gsa_end_session(v_sessao_id, v_token);
  DELETE FROM public.sistema_sessoes WHERE id = v_sessao_id;
END;
$$;
