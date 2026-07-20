DO $$
DECLARE
  v_sessao_id uuid;
  v_token text;
  v_cliente_id uuid := gen_random_uuid();
  v_result jsonb;
  v_saldo numeric;
  v_lancamentos integer;
  v_extrato integer;
  v_suffix text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
BEGIN
  SELECT sessao_id, session_token
    INTO v_sessao_id, v_token
  FROM public.gsa_start_session(
    'admin',
    '00000000-0000-0000-0000-000000000000',
    'Validador Saldo Cliente',
    '{"source":"validate_secure_admin_client_balance"}'::jsonb
  );

  INSERT INTO public.clientes(
    id, codigo_cliente, nome, cpf, telefone, status,
    saldo_carteira, saldo_pontos, pin_tentativas, pin_bloqueado,
    limite_credito_total, limite_credito_disponivel, opcao_pagamento_parcelado
  )
  VALUES (
    v_cliente_id,
    'TEST-SALDO-' || v_suffix,
    'Cliente Teste Saldo',
    '908' || substr(v_suffix, 1, 8),
    '11908' || substr(v_suffix, 1, 6),
    'ativo',
    10,
    0,
    0,
    false,
    0,
    0,
    false
  );

  SELECT public.gsa_admin_ajustar_saldo_cliente(
    v_sessao_id,
    v_token,
    v_cliente_id,
    'entrada',
    50,
    'Teste credito'
  )
    INTO v_result;

  IF NOT coalesce((v_result->>'success')::boolean, false) THEN
    RAISE EXCEPTION 'Falha ao creditar saldo: %', v_result;
  END IF;

  SELECT saldo_carteira INTO v_saldo FROM public.clientes WHERE id = v_cliente_id;
  IF v_saldo <> 60 THEN
    RAISE EXCEPTION 'Credito inconsistente. saldo=%', v_saldo;
  END IF;

  SELECT public.gsa_admin_ajustar_saldo_cliente(
    v_sessao_id,
    v_token,
    v_cliente_id,
    'saida',
    15,
    'Teste debito'
  )
    INTO v_result;

  IF NOT coalesce((v_result->>'success')::boolean, false) THEN
    RAISE EXCEPTION 'Falha ao debitar saldo: %', v_result;
  END IF;

  SELECT saldo_carteira INTO v_saldo FROM public.clientes WHERE id = v_cliente_id;
  SELECT count(*) INTO v_lancamentos FROM public.carteira_lancamentos WHERE cliente_id = v_cliente_id;
  SELECT count(*) INTO v_extrato FROM public.extrato_financeiro WHERE cliente_id = v_cliente_id;

  IF v_saldo <> 45 OR v_lancamentos <> 2 OR v_extrato <> 2 THEN
    RAISE EXCEPTION 'Debito inconsistente. saldo=%, lancamentos=%, extrato=%', v_saldo, v_lancamentos, v_extrato;
  END IF;

  DELETE FROM public.extrato_financeiro WHERE cliente_id = v_cliente_id;
  DELETE FROM public.carteira_lancamentos WHERE cliente_id = v_cliente_id;
  DELETE FROM public.clientes WHERE id = v_cliente_id;
  PERFORM public.gsa_end_session(v_sessao_id, v_token);
  DELETE FROM public.sistema_sessoes WHERE id = v_sessao_id;
END;
$$;
