DO $$
DECLARE
  v_sessao_id uuid;
  v_token text;
  v_cliente_id uuid := gen_random_uuid();
  v_fatura_id uuid := gen_random_uuid();
  v_fatura_filha_id uuid := gen_random_uuid();
  v_cobranca_id uuid := gen_random_uuid();
  v_parcela_id uuid := gen_random_uuid();
  v_result jsonb;
  v_count integer;
  v_suffix text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
  v_codigo_ref text := 'TEST-DEL-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
BEGIN
  SELECT sessao_id, session_token
    INTO v_sessao_id, v_token
  FROM public.gsa_start_session(
    'admin',
    '00000000-0000-0000-0000-000000000000',
    'Validador Excluir Cobranca',
    '{"source":"validate_secure_admin_collection_delete"}'::jsonb
  );

  INSERT INTO public.clientes(
    id, codigo_cliente, nome, cpf, telefone, status,
    saldo_carteira, saldo_pontos, pin_tentativas, pin_bloqueado,
    limite_credito_total, limite_credito_disponivel, opcao_pagamento_parcelado
  )
  VALUES (
    v_cliente_id,
    'TEST-DEL-' || v_suffix,
    'Cliente Teste Excluir Cobranca',
    '907' || substr(v_suffix, 1, 8),
    '11907' || substr(v_suffix, 1, 6),
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
      v_fatura_id,
      v_codigo_ref,
      v_cliente_id,
      200,
      0,
      200,
      'vencida',
      current_date - 10,
      current_date - 20,
      'Fatura original teste delete'
    ),
    (
      v_fatura_filha_id,
      'TEST-DEL-FILHA-' || v_suffix,
      v_cliente_id,
      100,
      0,
      100,
      'pendente',
      current_date + 5,
      current_date,
      'Parcela 1/2 do acordo ref ' || v_codigo_ref
    );

  INSERT INTO public.cobrancas(
    id, fatura_id, cliente_id, valor_original, valor_atualizado,
    valor_pago, status, nivel_cobranca, score_risco
  )
  VALUES (
    v_cobranca_id,
    v_fatura_id,
    v_cliente_id,
    200,
    200,
    0,
    'acordo',
    1,
    15
  );

  INSERT INTO public.cobranca_acordo_parcelas(
    id, cobranca_id, numero_parcela, valor_parcela, data_vencimento, status
  )
  VALUES (v_parcela_id, v_cobranca_id, 1, 100, current_date + 5, 'pendente');

  INSERT INTO public.cobranca_historico(cobranca_id, tipo_acao, descricao, canal)
  VALUES (v_cobranca_id, 'teste', 'Historico teste delete', 'sistema');

  SELECT public.gsa_admin_excluir_cobranca(v_sessao_id, v_token, v_cobranca_id)
    INTO v_result;

  IF NOT coalesce((v_result->>'success')::boolean, false) THEN
    RAISE EXCEPTION 'Falha ao excluir cobranca: %', v_result;
  END IF;

  SELECT count(*) INTO v_count FROM public.cobrancas WHERE id = v_cobranca_id;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Cobranca nao foi removida. count=%', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM public.cobranca_acordo_parcelas WHERE cobranca_id = v_cobranca_id;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Parcelas nao foram removidas. count=%', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM public.cobranca_historico WHERE cobranca_id = v_cobranca_id;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Historico nao foi removido. count=%', v_count;
  END IF;

  SELECT public.gsa_admin_excluir_cobranca(v_sessao_id, v_token, v_cobranca_id)
    INTO v_result;

  IF NOT coalesce((v_result->>'success')::boolean, false)
     OR NOT coalesce((v_result->>'already_deleted')::boolean, false) THEN
    RAISE EXCEPTION 'Idempotencia de excluir cobranca falhou: %', v_result;
  END IF;

  DELETE FROM public.faturas WHERE id IN (v_fatura_id, v_fatura_filha_id);
  DELETE FROM public.clientes WHERE id = v_cliente_id;
  PERFORM public.gsa_end_session(v_sessao_id, v_token);
  DELETE FROM public.sistema_sessoes WHERE id = v_sessao_id;
END;
$$;
