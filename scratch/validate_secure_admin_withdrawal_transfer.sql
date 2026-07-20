DO $$
DECLARE
  v_sessao_id uuid;
  v_token text;
  v_cliente_a uuid := gen_random_uuid();
  v_cliente_b uuid := gen_random_uuid();
  v_saque_rejeitar uuid := gen_random_uuid();
  v_saque_aprovar uuid := gen_random_uuid();
  v_trans_aprovar uuid := gen_random_uuid();
  v_trans_rejeitar uuid := gen_random_uuid();
  v_result jsonb;
  v_saldo numeric;
  v_status text;
  v_suffix text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
BEGIN
  SELECT sessao_id, session_token
    INTO v_sessao_id, v_token
  FROM public.gsa_start_session(
    'admin',
    '00000000-0000-0000-0000-000000000000',
    'Validador RPC Financeiro',
    '{"source":"validate_secure_admin_withdrawal_transfer"}'::jsonb
  );

  INSERT INTO public.clientes(
    id, codigo_cliente, nome, cpf, telefone, status,
    saldo_carteira, saldo_pontos, pin_tentativas, pin_bloqueado,
    limite_credito_total, limite_credito_disponivel, opcao_pagamento_parcelado
  )
  VALUES
    (v_cliente_a, 'TEST-RPC-A-' || v_suffix, 'Cliente Teste RPC A', '900' || substr(v_suffix, 1, 8), '11900' || substr(v_suffix, 1, 6), 'ativo', 100, 100, 0, false, 0, 0, false),
    (v_cliente_b, 'TEST-RPC-B-' || v_suffix, 'Cliente Teste RPC B', '901' || substr(v_suffix, 1, 8), '11901' || substr(v_suffix, 1, 6), 'ativo', 10, 10, 0, false, 0, 0, false);

  INSERT INTO public.saques(id, cliente_id, valor, taxa_aplicada, valor_liquido, tipo_chave_pix, chave_pix, status, data_solicitacao)
  VALUES
    (v_saque_rejeitar, v_cliente_a, 25, 0, 25, 'cpf', '90000000000', 'pendente', now()),
    (v_saque_aprovar, v_cliente_a, 15, 0, 15, 'cpf', '90000000000', 'pendente', now());

  SELECT public.gsa_admin_processar_saque(v_sessao_id, v_token, v_saque_rejeitar, 'rejeitar', 'Teste automatizado', current_date)
    INTO v_result;
  IF NOT coalesce((v_result->>'success')::boolean, false) THEN
    RAISE EXCEPTION 'Falha ao rejeitar saque: %', v_result;
  END IF;

  SELECT status INTO v_status FROM public.saques WHERE id = v_saque_rejeitar;
  SELECT saldo_carteira INTO v_saldo FROM public.clientes WHERE id = v_cliente_a;
  IF v_status <> 'cancelado' OR v_saldo <> 125 THEN
    RAISE EXCEPTION 'Rejeicao de saque inconsistente. status=%, saldo=%', v_status, v_saldo;
  END IF;

  SELECT public.gsa_admin_processar_saque(v_sessao_id, v_token, v_saque_aprovar, 'aprovar', null, current_date)
    INTO v_result;
  IF NOT coalesce((v_result->>'success')::boolean, false) THEN
    RAISE EXCEPTION 'Falha ao aprovar saque: %', v_result;
  END IF;

  SELECT status INTO v_status FROM public.saques WHERE id = v_saque_aprovar;
  IF v_status <> 'pago' THEN
    RAISE EXCEPTION 'Aprovacao de saque inconsistente. status=%', v_status;
  END IF;

  INSERT INTO public.transferencias(
    id, cliente_origem_id, cliente_destino_id, tipo, valor, taxa_aplicada,
    valor_liquido, motivo, status, data_solicitacao
  )
  VALUES
    (v_trans_aprovar, v_cliente_a, v_cliente_b, 'saldo', 30, 0, 30, 'Teste aprovacao', 'em_analise', now()),
    (v_trans_rejeitar, v_cliente_a, v_cliente_b, 'saldo', 20, 0, 20, 'Teste rejeicao', 'em_analise', now());

  SELECT public.gsa_admin_processar_transferencia(v_sessao_id, v_token, v_trans_aprovar, 'aprovar', null, current_date)
    INTO v_result;
  IF NOT coalesce((v_result->>'success')::boolean, false) THEN
    RAISE EXCEPTION 'Falha ao aprovar transferencia: %', v_result;
  END IF;

  SELECT status INTO v_status FROM public.transferencias WHERE id = v_trans_aprovar;
  SELECT saldo_carteira INTO v_saldo FROM public.clientes WHERE id = v_cliente_b;
  IF v_status <> 'aprovado' OR v_saldo <> 40 THEN
    RAISE EXCEPTION 'Aprovacao de transferencia inconsistente. status=%, saldo_destino=%', v_status, v_saldo;
  END IF;

  SELECT public.gsa_admin_processar_transferencia(v_sessao_id, v_token, v_trans_aprovar, 'estornar', 'Teste estorno', current_date)
    INTO v_result;
  IF NOT coalesce((v_result->>'success')::boolean, false) THEN
    RAISE EXCEPTION 'Falha ao estornar transferencia: %', v_result;
  END IF;

  SELECT status INTO v_status FROM public.transferencias WHERE id = v_trans_aprovar;
  SELECT saldo_carteira INTO v_saldo FROM public.clientes WHERE id = v_cliente_b;
  IF v_status <> 'estornado' OR v_saldo <> 10 THEN
    RAISE EXCEPTION 'Estorno de transferencia inconsistente. status=%, saldo_destino=%', v_status, v_saldo;
  END IF;

  SELECT public.gsa_admin_processar_transferencia(v_sessao_id, v_token, v_trans_rejeitar, 'rejeitar', 'Teste rejeicao', current_date)
    INTO v_result;
  IF NOT coalesce((v_result->>'success')::boolean, false) THEN
    RAISE EXCEPTION 'Falha ao rejeitar transferencia: %', v_result;
  END IF;

  SELECT status INTO v_status FROM public.transferencias WHERE id = v_trans_rejeitar;
  IF v_status <> 'cancelado' THEN
    RAISE EXCEPTION 'Rejeicao de transferencia inconsistente. status=%', v_status;
  END IF;

  DELETE FROM public.extrato_financeiro WHERE referencia_id IN (v_saque_rejeitar, v_saque_aprovar, v_trans_aprovar, v_trans_rejeitar);
  DELETE FROM public.points_transactions WHERE cliente_id IN (v_cliente_a, v_cliente_b);
  DELETE FROM public.pontos_movimentacoes WHERE cliente_id IN (v_cliente_a, v_cliente_b);
  DELETE FROM public.transferencias WHERE id IN (v_trans_aprovar, v_trans_rejeitar);
  DELETE FROM public.saques WHERE id IN (v_saque_rejeitar, v_saque_aprovar);
  DELETE FROM public.clientes WHERE id IN (v_cliente_a, v_cliente_b);
  PERFORM public.gsa_end_session(v_sessao_id, v_token);
  DELETE FROM public.sistema_sessoes WHERE id = v_sessao_id;
END;
$$;
