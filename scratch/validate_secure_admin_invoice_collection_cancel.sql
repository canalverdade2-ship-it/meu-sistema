DO $$
DECLARE
  v_sessao_id uuid;
  v_token text;
  v_cliente_id uuid := gen_random_uuid();
  v_fatura_cobranca uuid := gen_random_uuid();
  v_fatura_cancelar uuid := gen_random_uuid();
  v_fatura_paga uuid := gen_random_uuid();
  v_result jsonb;
  v_cobrancas integer;
  v_status text;
  v_suffix text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
BEGIN
  SELECT sessao_id, session_token
    INTO v_sessao_id, v_token
  FROM public.gsa_start_session(
    'admin',
    '00000000-0000-0000-0000-000000000000',
    'Validador Cobranca Cancelamento',
    '{"source":"validate_secure_admin_invoice_collection_cancel"}'::jsonb
  );

  INSERT INTO public.clientes(
    id, codigo_cliente, nome, cpf, telefone, status,
    saldo_carteira, saldo_pontos, pin_tentativas, pin_bloqueado,
    limite_credito_total, limite_credito_disponivel, opcao_pagamento_parcelado
  )
  VALUES (
    v_cliente_id,
    'TEST-COB-' || v_suffix,
    'Cliente Teste Cobranca Cancelamento',
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
  VALUES
    (v_fatura_cobranca, 'TEST-COB-' || v_suffix, v_cliente_id, 90, 0, 90, 'pendente', current_date - 5, current_date - 10),
    (v_fatura_cancelar, 'TEST-CAN-' || v_suffix, v_cliente_id, 70, 0, 70, 'pendente', current_date + 5, current_date),
    (v_fatura_paga, 'TEST-PAG-' || v_suffix, v_cliente_id, 50, 50, 0, 'pago', current_date, current_date);

  SELECT public.gsa_admin_enviar_fatura_cobranca(v_sessao_id, v_token, v_fatura_cobranca)
    INTO v_result;
  IF NOT coalesce((v_result->>'success')::boolean, false) THEN
    RAISE EXCEPTION 'Falha ao enviar para cobranca: %', v_result;
  END IF;

  SELECT public.gsa_admin_enviar_fatura_cobranca(v_sessao_id, v_token, v_fatura_cobranca)
    INTO v_result;
  IF NOT coalesce((v_result->>'success')::boolean, false)
     OR NOT coalesce((v_result->>'already_exists')::boolean, false) THEN
    RAISE EXCEPTION 'Idempotencia da cobranca falhou: %', v_result;
  END IF;

  SELECT count(*) INTO v_cobrancas FROM public.cobrancas WHERE fatura_id = v_fatura_cobranca;
  IF v_cobrancas <> 1 THEN
    RAISE EXCEPTION 'Cobranca duplicada criada. total=%', v_cobrancas;
  END IF;

  SELECT public.gsa_admin_enviar_fatura_cobranca(v_sessao_id, v_token, v_fatura_cancelar)
    INTO v_result;

  SELECT public.gsa_admin_cancelar_fatura(v_sessao_id, v_token, v_fatura_cancelar, 'Teste automatizado')
    INTO v_result;
  IF NOT coalesce((v_result->>'success')::boolean, false) THEN
    RAISE EXCEPTION 'Falha ao cancelar fatura: %', v_result;
  END IF;

  SELECT status INTO v_status FROM public.faturas WHERE id = v_fatura_cancelar;
  SELECT count(*) INTO v_cobrancas FROM public.cobrancas WHERE fatura_id = v_fatura_cancelar;
  IF v_status <> 'cancelado' OR v_cobrancas <> 0 THEN
    RAISE EXCEPTION 'Cancelamento inconsistente. status=%, cobrancas=%', v_status, v_cobrancas;
  END IF;

  BEGIN
    PERFORM public.gsa_admin_cancelar_fatura(v_sessao_id, v_token, v_fatura_paga, 'Nao deve cancelar');
    RAISE EXCEPTION 'Cancelamento de fatura paga deveria ter falhado.';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Cancelamento de fatura paga deveria ter falhado.' THEN
      RAISE;
    END IF;
  END;

  DELETE FROM public.cobranca_historico WHERE cobranca_id IN (SELECT id FROM public.cobrancas WHERE fatura_id IN (v_fatura_cobranca, v_fatura_cancelar));
  DELETE FROM public.cobrancas WHERE fatura_id IN (v_fatura_cobranca, v_fatura_cancelar);
  DELETE FROM public.faturas WHERE id IN (v_fatura_cobranca, v_fatura_cancelar, v_fatura_paga);
  DELETE FROM public.clientes WHERE id = v_cliente_id;
  PERFORM public.gsa_end_session(v_sessao_id, v_token);
  DELETE FROM public.sistema_sessoes WHERE id = v_sessao_id;
END;
$$;
