DO $$
DECLARE
  v_client_id uuid := gen_random_uuid();
  v_other_id uuid := gen_random_uuid();
  v_session jsonb;
  v_other_session jsonb;
  v_product_id uuid := gen_random_uuid();
  v_replacement_id uuid := gen_random_uuid();
  v_service_id uuid := gen_random_uuid();
  v_plan_id uuid := gen_random_uuid();
  v_promotion_id uuid := gen_random_uuid();
  v_product_budget_id uuid := gen_random_uuid();
  v_service_budget_id uuid := gen_random_uuid();
  v_subscription_budget_id uuid := gen_random_uuid();
  v_credit_budget_id uuid := gen_random_uuid();
  v_exchange_budget_id uuid := gen_random_uuid();
  v_expired_budget_id uuid := gen_random_uuid();
  v_exchange_order_id uuid := gen_random_uuid();
  v_expired_order_id uuid := gen_random_uuid();
  v_loan_id uuid := gen_random_uuid();
  v_result jsonb;
  v_repeat jsonb;
  v_exchange_id uuid;
  v_count integer;
  v_value numeric;
  v_rejected boolean;
BEGIN
  INSERT INTO public.clientes(
    id, nome, tipo_pessoa, status, saldo_pontos, saldo_carteira,
    limite_credito_total, limite_credito_disponivel
  ) VALUES
    (v_client_id, 'Cliente Fluxos Integrados', 'pf', 'ativo', 0, 0, 0, 0),
    (v_other_id, 'Outro Cliente Integrado', 'pf', 'ativo', 0, 0, 0, 0);
  v_session := public.gsa_create_session_internal('cliente', v_client_id, 'Cliente Fluxos Integrados', '{}'::jsonb);
  v_other_session := public.gsa_create_session_internal('cliente', v_other_id, 'Outro Cliente Integrado', '{}'::jsonb);

  INSERT INTO public.produtos(
    id, codigo_produto, nome, valor, status, tipo_cliente,
    visivel_na_loja, controle_estoque, estoque, estoque_disponivel
  ) VALUES
    (v_product_id, 'PRD-FLX-' || left(v_product_id::text, 8), 'Produto Fluxo Original',
      100, 'ativo', 'pf', true, true, 20, 20),
    (v_replacement_id, 'PRD-SUB-' || left(v_replacement_id::text, 8), 'Produto Substituto',
      50, 'ativo', 'pf', true, true, 20, 20);
  INSERT INTO public.servicos(
    id, codigo_servico, nome, valor, status, tipo_cliente
  ) VALUES (
    v_service_id, 'SRV-FLX-' || left(v_service_id::text, 8), 'Serviço Fluxo', 200, 'ativo', 'pf'
  );
  INSERT INTO public.assinaturas(
    id, codigo_assinatura, nome, valor, status, tipo_cliente
  ) VALUES (
    v_plan_id, 'ASS-FLX-' || left(v_plan_id::text, 8), 'Assinatura Fluxo', 80, 'ativo', 'pf'
  );
  INSERT INTO public.promocoes(
    id, codigo_promocao, titulo, descricao, tipo,
    data_inicio_divulgacao, data_fim_divulgacao, prazo_validade_meses,
    status, tipo_desconto, valor_desconto
  ) VALUES (
    v_promotion_id, 'PRO-FLX-' || left(v_promotion_id::text, 8),
    'Promoção Fluxo', 'Promoção de teste transacional', 'produto',
    now() - interval '1 day', now() + interval '10 days', 1,
    'ativa', 'porcentagem', 10
  );

  -- Aprovação de produto em negociação: total, ordem, fatura, promoção e idempotência.
  INSERT INTO public.orcamentos(
    id, codigo_orcamento, cliente_id, produto_id, categoria, quantidade,
    total, status, proposta_admin_porcentagem, promocao_id
  ) VALUES (
    v_product_budget_id, 'ORC-PRO-' || left(v_product_budget_id::text, 8),
    v_client_id, v_product_id, 'produto', 2, 100, 'negociação', 10, v_promotion_id
  );
  INSERT INTO public.cliente_promocoes(
    cliente_id, promocao_id, data_expiracao, status
  ) VALUES (v_client_id, v_promotion_id, now() + interval '10 days', 'ativa');

  v_result := public.gsa_client_approve_budget(
    (v_session ->> 'sessao_id')::uuid, v_session ->> 'session_token', v_product_budget_id
  );
  IF (v_result ->> 'total_aprovado')::numeric <> 90 OR v_result ->> 'tipo' <> 'produto' THEN
    RAISE EXCEPTION 'Aprovação do produto calculou resultado incorreto: %', v_result;
  END IF;
  SELECT count(*) INTO v_count FROM public.ordens_compra WHERE orcamento_id = v_product_budget_id;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Aprovação não criou exatamente uma ordem de compra.'; END IF;
  SELECT count(*) INTO v_count FROM public.faturas
  WHERE orcamento_id = v_product_budget_id AND valor_total = 90 AND status = 'pendente';
  IF v_count <> 1 THEN RAISE EXCEPTION 'Aprovação não criou a fatura correta.'; END IF;
  SELECT count(*) INTO v_count FROM public.cliente_promocoes
  WHERE cliente_id = v_client_id AND promocao_id = v_promotion_id AND status = 'usada';
  IF v_count <> 1 THEN RAISE EXCEPTION 'Promoção do cliente não foi consumida.'; END IF;
  SELECT count(*) INTO v_count FROM public.promocoes WHERE id = v_promotion_id AND status = 'ativa';
  IF v_count <> 1 THEN RAISE EXCEPTION 'A promoção global foi encerrada indevidamente.'; END IF;
  v_repeat := public.gsa_client_approve_budget(
    (v_session ->> 'sessao_id')::uuid, v_session ->> 'session_token', v_product_budget_id
  );
  IF coalesce((v_repeat ->> 'already_approved')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Aprovação repetida não foi reconhecida.';
  END IF;
  SELECT count(*) INTO v_count FROM public.faturas WHERE orcamento_id = v_product_budget_id;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Aprovação repetida duplicou a fatura.'; END IF;
  v_rejected := false;
  BEGIN
    PERFORM public.gsa_client_approve_budget(
      (v_other_session ->> 'sessao_id')::uuid, v_other_session ->> 'session_token', v_product_budget_id
    );
  EXCEPTION WHEN others THEN v_rejected := true;
  END;
  IF v_rejected IS NOT TRUE THEN RAISE EXCEPTION 'Outro cliente aprovou o orçamento.'; END IF;

  -- Aprovação de serviço cria OS ligada ao serviço e uma única demanda.
  INSERT INTO public.orcamentos(
    id, codigo_orcamento, cliente_id, servico_id, categoria,
    total, status, titulo_solicitacao, descricao_solicitacao
  ) VALUES (
    v_service_budget_id, 'ORC-SRV-' || left(v_service_budget_id::text, 8),
    v_client_id, v_service_id, 'servico', 200, 'aberto',
    'Solicitação integrada', 'Descrição do serviço integrado'
  );
  v_result := public.gsa_client_approve_budget(
    (v_session ->> 'sessao_id')::uuid, v_session ->> 'session_token', v_service_budget_id
  );
  SELECT count(*) INTO v_count
  FROM public.ordens_servico os
  JOIN public.prestador_demandas d ON d.os_id = os.id
  WHERE os.orcamento_id = v_service_budget_id AND os.servico_id = v_service_id;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Aprovação do serviço não ligou OS e demanda corretamente.'; END IF;

  -- Aprovação de assinatura cria ordem e fatura vinculadas ao mesmo orçamento.
  INSERT INTO public.orcamentos(
    id, codigo_orcamento, cliente_id, assinatura_id, categoria,
    quantidade_meses, total, status
  ) VALUES (
    v_subscription_budget_id, 'ORC-ASS-' || left(v_subscription_budget_id::text, 8),
    v_client_id, v_plan_id, 'assinatura', 3, 240, 'aberto'
  );
  v_result := public.gsa_client_approve_budget(
    (v_session ->> 'sessao_id')::uuid, v_session ->> 'session_token', v_subscription_budget_id
  );
  SELECT count(*) INTO v_count
  FROM public.ordens_assinatura oa
  JOIN public.faturas f ON f.ordem_assinatura_id = oa.id AND f.orcamento_id = v_subscription_budget_id
  WHERE oa.orcamento_id = v_subscription_budget_id;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Aprovação da assinatura não ligou ordem e fatura.'; END IF;

  -- Solicitação e recusa de quitação do crédito são vinculadas ao ator.
  INSERT INTO public.orcamentos(
    id, codigo_orcamento, cliente_id, produto_id, categoria, total, status,
    origem_gsa_store
  ) VALUES (
    v_credit_budget_id, 'ODC-CRE-' || left(v_credit_budget_id::text, 8),
    v_client_id, v_product_id, 'loja', 100, 'pago', true
  );
  INSERT INTO public.faturas(
    codigo_fatura, cliente_id, orcamento_id, valor_total,
    valor_final_pendente, status, tipo, is_amortizacao_credito
  ) VALUES (
    'FAT-CRE-FLX-' || left(v_credit_budget_id::text, 8), v_client_id,
    v_credit_budget_id, 100, 100, 'pendente', 'produto', true
  );
  v_result := public.gsa_client_request_store_credit_settlement(
    (v_session ->> 'sessao_id')::uuid, v_session ->> 'session_token', v_credit_budget_id
  );
  IF v_result ->> 'status' <> 'analise_quitacao' THEN RAISE EXCEPTION 'Solicitação de quitação do crédito falhou.'; END IF;
  UPDATE public.orcamentos SET status_quitacao_credito = 'aguardando_pagamento_quitacao', valor_quitacao_acordo = 80
  WHERE id = v_credit_budget_id;
  PERFORM public.gsa_client_reject_store_credit_settlement(
    (v_session ->> 'sessao_id')::uuid, v_session ->> 'session_token', v_credit_budget_id
  );
  SELECT count(*) INTO v_count FROM public.orcamentos
  WHERE id = v_credit_budget_id AND status_quitacao_credito IS NULL AND valor_quitacao_acordo IS NULL;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Recusa da quitação do crédito não limpou a oferta.'; END IF;

  -- Solicitação e recusa de quitação do empréstimo preservam histórico e status.
  INSERT INTO public.emprestimos(
    id, codigo_emprestimo, cliente_id, valor_solicitado,
    valor_aprovado, valor_total_financiado, status
  ) VALUES (
    v_loan_id, 'EMP-FLX-' || left(v_loan_id::text, 8), v_client_id,
    200, 200, 200, 'ativo'
  );
  v_result := public.gsa_client_request_loan_settlement(
    (v_session ->> 'sessao_id')::uuid, v_session ->> 'session_token', v_loan_id
  );
  IF v_result ->> 'status' <> 'analise_quitacao' THEN RAISE EXCEPTION 'Solicitação de quitação do empréstimo falhou.'; END IF;
  UPDATE public.emprestimos SET status = 'aguardando_pagamento_quitacao', valor_quitacao_acordo = 150
  WHERE id = v_loan_id;
  PERFORM public.gsa_client_reject_loan_settlement(
    (v_session ->> 'sessao_id')::uuid, v_session ->> 'session_token', v_loan_id
  );
  SELECT count(*) INTO v_count FROM public.emprestimos
  WHERE id = v_loan_id AND status = 'ativo' AND valor_quitacao_acordo IS NULL;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Recusa da quitação do empréstimo não restaurou o contrato.'; END IF;

  -- Troca usa o valor unitário registrado no pedido, não o preço atual do catálogo.
  INSERT INTO public.orcamentos(
    id, codigo_orcamento, cliente_id, produto_id, categoria,
    total, status, origem_gsa_store, data_entrega
  ) VALUES (
    v_exchange_budget_id, 'ODC-TRC-' || left(v_exchange_budget_id::text, 8),
    v_client_id, v_product_id, 'loja', 40, 'pago', true, now() - interval '1 day'
  );
  INSERT INTO public.ordens_compra(
    id, codigo_ordem, produto_id, cliente_id, status,
    quantidade, data_conclusao, orcamento_id
  ) VALUES (
    v_exchange_order_id, 'OC-TRC-' || left(v_exchange_order_id::text, 8),
    v_product_id, v_client_id, 'concluido', 1, now() - interval '1 day', v_exchange_budget_id
  );
  INSERT INTO public.loja_pedido_itens(
    orcamento_id, cliente_id, tipo, item_id, produto_id,
    codigo, nome, valor_unitario, quantidade, subtotal
  ) VALUES (
    v_exchange_budget_id, v_client_id, 'produto', v_product_id, v_product_id,
    'PRD-ORIGINAL', 'Produto Fluxo Original', 40, 1, 40
  );
  v_result := public.gsa_client_request_store_exchange(
    (v_session ->> 'sessao_id')::uuid, v_session ->> 'session_token',
    gen_random_uuid(), v_exchange_budget_id, 'troca',
    'Produto recebido com defeito de fabricação.',
    jsonb_build_array(
      'https://ocgajvagxagutfvgxwsy.supabase.co/storage/v1/object/public/gsa-store-images/trocas/'
        || v_client_id::text || '/foto-teste.jpg'
    ),
    'correios', jsonb_build_array(v_exchange_order_id::text),
    'outro_produto', jsonb_build_array(jsonb_build_object('produto_id', v_replacement_id, 'quantidade', 1))
  );
  v_exchange_id := (v_result ->> 'solicitacao_id')::uuid;
  IF (v_result ->> 'credito_troca')::numeric <> 40
     OR (v_result ->> 'valor_novos_produtos')::numeric <> 50
     OR (v_result ->> 'valor_diferenca')::numeric <> 10 THEN
    RAISE EXCEPTION 'Cálculo autoritativo da troca está incorreto: %', v_result;
  END IF;
  SELECT count(*) INTO v_count FROM public.loja_solicitacoes
  WHERE id = v_exchange_id AND cliente_id = v_client_id AND valor_diferenca = 10;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Solicitação de troca não foi persistida corretamente.'; END IF;
  v_rejected := false;
  BEGIN
    PERFORM public.gsa_client_submit_exchange_tracking(
      (v_other_session ->> 'sessao_id')::uuid, v_other_session ->> 'session_token',
      v_exchange_id, 'OB123456789BR'
    );
  EXCEPTION WHEN others THEN v_rejected := true;
  END;
  IF v_rejected IS NOT TRUE THEN RAISE EXCEPTION 'Outro cliente alterou o rastreio da troca.'; END IF;
  UPDATE public.loja_solicitacoes SET status = 'aguardando_devolucao' WHERE id = v_exchange_id;
  v_result := public.gsa_client_submit_exchange_tracking(
    (v_session ->> 'sessao_id')::uuid, v_session ->> 'session_token',
    v_exchange_id, 'ob123456789br'
  );
  IF v_result ->> 'codigo_rastreio' <> 'OB123456789BR' THEN
    RAISE EXCEPTION 'Rastreio não foi normalizado corretamente.';
  END IF;

  -- Pedido fora dos 7 dias deve ser rejeitado pelo banco.
  INSERT INTO public.orcamentos(
    id, codigo_orcamento, cliente_id, produto_id, categoria,
    total, status, origem_gsa_store, data_entrega
  ) VALUES (
    v_expired_budget_id, 'ODC-EXP-' || left(v_expired_budget_id::text, 8),
    v_client_id, v_product_id, 'loja', 100, 'pago', true, now() - interval '8 days'
  );
  INSERT INTO public.ordens_compra(
    id, codigo_ordem, produto_id, cliente_id, status,
    quantidade, data_conclusao, orcamento_id
  ) VALUES (
    v_expired_order_id, 'OC-EXP-' || left(v_expired_order_id::text, 8),
    v_product_id, v_client_id, 'concluido', 1, now() - interval '8 days', v_expired_budget_id
  );
  v_rejected := false;
  BEGIN
    PERFORM public.gsa_client_request_store_exchange(
      (v_session ->> 'sessao_id')::uuid, v_session ->> 'session_token',
      gen_random_uuid(), v_expired_budget_id, 'devolucao',
      'Solicitação fora do prazo para validar a regra.',
      jsonb_build_array(
        'https://ocgajvagxagutfvgxwsy.supabase.co/storage/v1/object/public/gsa-store-images/trocas/'
          || v_client_id::text || '/foto-expirada.jpg'
      ),
      'correios', jsonb_build_array(v_expired_order_id::text), NULL, '[]'::jsonb
    );
  EXCEPTION WHEN others THEN v_rejected := true;
  END;
  IF v_rejected IS NOT TRUE THEN RAISE EXCEPTION 'Troca fora do prazo de 7 dias foi aceita.'; END IF;

  IF has_function_privilege('anon', 'public.aprovar_orcamento_cliente(uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.solicitar_troca(json)', 'EXECUTE') THEN
    RAISE EXCEPTION 'RPC legada de orçamento ou troca continua executável por anon.';
  END IF;
END;
$$;

