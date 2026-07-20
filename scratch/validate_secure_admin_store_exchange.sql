DO $$
DECLARE
  v_sessao_id uuid;
  v_token text;
  v_cliente_id uuid := gen_random_uuid();
  v_orcamento_id uuid := gen_random_uuid();
  v_solicitacao_id uuid := gen_random_uuid();
  v_fatura_credito_id uuid := gen_random_uuid();
  v_result jsonb;
  v_status text;
  v_disp numeric;
  v_count integer;
  v_mov_count integer;
  v_suffix text := lpad(floor(random() * 100000000)::int::text, 8, '0');
  v_codigo_orc text := 'ODC-TEST-' || lpad(floor(random() * 10000)::int::text, 4, '0');
  v_codigo_sol text := 'TROCA-TEST-' || lpad(floor(random() * 10000)::int::text, 4, '0');
BEGIN
  SELECT sessao_id, session_token
    INTO v_sessao_id, v_token
  FROM public.gsa_start_session(
    'admin',
    '00000000-0000-0000-0000-000000000000',
    'Validador Trocas Loja',
    '{"source":"validate_secure_admin_store_exchange"}'::jsonb
  );

  INSERT INTO public.clientes(
    id, codigo_cliente, nome, cpf, telefone, status,
    saldo_carteira, saldo_pontos, pin_tentativas, pin_bloqueado,
    limite_credito_total, limite_credito_disponivel
  )
  VALUES (
    v_cliente_id,
    'TEST-TR-' || v_suffix,
    'Cliente Teste Troca',
    '917' || substr(v_suffix, 1, 8),
    '11917' || substr(v_suffix, 1, 6),
    'ativo',
    0,
    0,
    0,
    false,
    1000,
    200
  );

  INSERT INTO public.orcamentos(
    id, codigo_orcamento, cliente_id, categoria, status, total,
    valor_servico, valor_adicional, acrescimo, desconto, observacoes_servico,
    descricao_adicional, origem_gsa_store
  )
  VALUES (
    v_orcamento_id, v_codigo_orc, v_cliente_id, 'loja', 'aprovado', 300,
    300, 0, 0, 0, 'Pedido teste', '', true
  );

  INSERT INTO public.loja_solicitacoes(
    id, codigo_solicitacao, cliente_id, orcamento_origem_id, tipo, motivo,
    status, valor_diferenca, historico_status
  )
  VALUES (
    v_solicitacao_id, v_codigo_sol, v_cliente_id, v_orcamento_id, 'troca',
    'Teste de troca', 'em_analise', 50, '{}'::jsonb
  );

  INSERT INTO public.faturas(
    id, codigo_fatura, cliente_id, valor_total, valor_final_pendente, status,
    tipo, is_amortizacao_credito, itens_faturados
  )
  VALUES (
    v_fatura_credito_id,
    'FAT-CRE-' || v_codigo_orc || '-1',
    v_cliente_id,
    300,
    300,
    'pendente',
    'produto',
    true,
    jsonb_build_array(jsonb_build_object('codigo', 'CRE-' || v_codigo_orc))
  );

  SELECT public.gsa_admin_atualizar_solicitacao_loja(v_sessao_id, v_token, v_solicitacao_id, 'aprovado', 'Aprovado no teste')
    INTO v_result;

  SELECT status INTO v_status FROM public.loja_solicitacoes WHERE id = v_solicitacao_id;
  IF v_status <> 'aprovado' THEN RAISE EXCEPTION 'Status da solicitacao inconsistente: %', v_status; END IF;

  SELECT count(*) INTO v_count
  FROM public.faturas
  WHERE codigo_fatura = 'FAT-TROCA-' || v_codigo_sol
    AND cliente_id = v_cliente_id
    AND valor_total = 50;

  IF v_count <> 1 THEN RAISE EXCEPTION 'Fatura de diferenca nao foi criada. count=%', v_count; END IF;

  SELECT limite_credito_disponivel INTO v_disp FROM public.clientes WHERE id = v_cliente_id;
  IF v_disp <> 500 THEN RAISE EXCEPTION 'Limite disponivel nao foi restaurado. disp=%', v_disp; END IF;

  SELECT count(*) INTO v_count FROM public.faturas WHERE id = v_fatura_credito_id AND status = 'cancelado';
  IF v_count <> 1 THEN RAISE EXCEPTION 'Fatura de amortizacao nao foi cancelada.'; END IF;

  SELECT count(*) INTO v_mov_count
  FROM public.loja_credito_movimentacoes
  WHERE cliente_id = v_cliente_id
    AND tipo = 'estorno_compra';

  IF v_mov_count <> 1 THEN RAISE EXCEPTION 'Movimento de estorno inconsistente. count=%', v_mov_count; END IF;

  SELECT public.gsa_admin_atualizar_solicitacao_loja(v_sessao_id, v_token, v_solicitacao_id, 'aprovado', 'Duplo clique')
    INTO v_result;

  IF NOT coalesce((v_result->>'already_processed')::boolean, false) THEN
    RAISE EXCEPTION 'Segundo clique deveria retornar already_processed.';
  END IF;

  SELECT limite_credito_disponivel INTO v_disp FROM public.clientes WHERE id = v_cliente_id;
  SELECT count(*) INTO v_mov_count
  FROM public.loja_credito_movimentacoes
  WHERE cliente_id = v_cliente_id
    AND tipo = 'estorno_compra';

  IF v_disp <> 500 OR v_mov_count <> 1 THEN
    RAISE EXCEPTION 'Segundo clique duplicou estorno. disp=%, mov=%', v_disp, v_mov_count;
  END IF;

  DELETE FROM public.loja_credito_movimentacoes WHERE cliente_id = v_cliente_id;
  DELETE FROM public.faturas WHERE cliente_id = v_cliente_id;
  DELETE FROM public.loja_solicitacoes WHERE id = v_solicitacao_id;
  DELETE FROM public.orcamentos WHERE id = v_orcamento_id;
  DELETE FROM public.clientes WHERE id = v_cliente_id;
  PERFORM public.gsa_end_session(v_sessao_id, v_token);
  DELETE FROM public.sistema_sessoes WHERE id = v_sessao_id;
END;
$$;
