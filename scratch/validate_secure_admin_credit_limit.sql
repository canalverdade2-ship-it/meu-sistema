DO $$
DECLARE
  v_sessao_id uuid;
  v_token text;
  v_cliente_id uuid := gen_random_uuid();
  v_sol_aumento uuid := gen_random_uuid();
  v_sol_contrato uuid := gen_random_uuid();
  v_result jsonb;
  v_total numeric;
  v_disp numeric;
  v_count integer;
  v_bool boolean;
  v_suffix text := lpad(floor(random() * 100000000)::int::text, 8, '0');
BEGIN
  SELECT sessao_id, session_token
    INTO v_sessao_id, v_token
  FROM public.gsa_start_session(
    'admin',
    '00000000-0000-0000-0000-000000000000',
    'Validador Limite Credito',
    '{"source":"validate_secure_admin_credit_limit"}'::jsonb
  );

  INSERT INTO public.clientes(
    id, codigo_cliente, nome, cpf, telefone, status,
    saldo_carteira, saldo_pontos, pin_tentativas, pin_bloqueado,
    limite_credito_total, limite_credito_disponivel, opcao_pagamento_parcelado
  )
  VALUES (
    v_cliente_id,
    'TEST-CRED-' || v_suffix,
    'Cliente Teste Credito',
    '912' || substr(v_suffix, 1, 8),
    '11912' || substr(v_suffix, 1, 6),
    'ativo',
    0,
    0,
    0,
    false,
    100,
    40,
    false
  );

  INSERT INTO public.loja_credito_solicitacoes(
    id, cliente_id, tipo_solicitacao, status, limite_solicitado
  )
  VALUES (
    v_sol_aumento,
    v_cliente_id,
    'alteracao',
    'analise',
    200
  );

  SELECT public.gsa_admin_aprovar_aumento_credito(v_sessao_id, v_token, v_sol_aumento, 200)
    INTO v_result;

  IF NOT coalesce((v_result->>'success')::boolean, false) THEN
    RAISE EXCEPTION 'Falha ao aprovar aumento: %', v_result;
  END IF;

  SELECT limite_credito_total, limite_credito_disponivel
    INTO v_total, v_disp
  FROM public.clientes
  WHERE id = v_cliente_id;

  IF v_total <> 200 OR v_disp <> 140 THEN
    RAISE EXCEPTION 'Aumento inconsistente. total=%, disp=%', v_total, v_disp;
  END IF;

  INSERT INTO public.loja_credito_solicitacoes(
    id, cliente_id, tipo_solicitacao, status, limite_solicitado,
    limite_aprovado, opcao_pagamento_parcelado, max_parcelas
  )
  VALUES (
    v_sol_contrato,
    v_cliente_id,
    'adesao',
    'contrato_assinado',
    300,
    300,
    true,
    6
  );

  SELECT public.gsa_admin_liberar_credito_contrato(v_sessao_id, v_token, v_sol_contrato)
    INTO v_result;

  IF NOT coalesce((v_result->>'success')::boolean, false) THEN
    RAISE EXCEPTION 'Falha ao liberar contrato: %', v_result;
  END IF;

  SELECT limite_credito_total, limite_credito_disponivel, opcao_pagamento_parcelado
    INTO v_total, v_disp, v_bool
  FROM public.clientes
  WHERE id = v_cliente_id;

  IF v_total <> 300 OR v_disp <> 240 OR v_bool IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Liberacao contrato inconsistente. total=%, disp=%, parcelado=%', v_total, v_disp, v_bool;
  END IF;

  SELECT public.gsa_admin_ajustar_limite_credito_cliente(v_sessao_id, v_token, v_cliente_id, 250, 'Teste ajuste')
    INTO v_result;

  SELECT limite_credito_total, limite_credito_disponivel
    INTO v_total, v_disp
  FROM public.clientes
  WHERE id = v_cliente_id;

  IF v_total <> 250 OR v_disp <> 190 THEN
    RAISE EXCEPTION 'Ajuste manual inconsistente. total=%, disp=%', v_total, v_disp;
  END IF;

  SELECT public.gsa_admin_definir_parcelamento_credito(v_sessao_id, v_token, v_cliente_id, false)
    INTO v_result;

  SELECT opcao_pagamento_parcelado INTO v_bool FROM public.clientes WHERE id = v_cliente_id;
  IF v_bool IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Parcelamento nao alterou.';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.loja_credito_movimentacoes
  WHERE cliente_id = v_cliente_id;

  IF v_count <> 3 THEN
    RAISE EXCEPTION 'Ledger de credito inconsistente. count=%', v_count;
  END IF;

  DELETE FROM public.loja_credito_movimentacoes WHERE cliente_id = v_cliente_id;
  DELETE FROM public.loja_credito_solicitacoes WHERE id IN (v_sol_aumento, v_sol_contrato);
  DELETE FROM public.clientes WHERE id = v_cliente_id;
  PERFORM public.gsa_end_session(v_sessao_id, v_token);
  DELETE FROM public.sistema_sessoes WHERE id = v_sessao_id;
END;
$$;
