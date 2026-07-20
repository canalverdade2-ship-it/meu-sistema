DO $$
DECLARE
  v_client_id uuid := gen_random_uuid();
  v_other_id uuid := gen_random_uuid();
  v_bonus_client_id uuid := gen_random_uuid();
  v_session jsonb;
  v_other_session jsonb;
  v_bonus_session jsonb;
  v_level_id uuid := gen_random_uuid();
  v_product_id uuid := gen_random_uuid();
  v_budget_id uuid := gen_random_uuid();
  v_other_budget_id uuid := gen_random_uuid();
  v_order_id uuid := gen_random_uuid();
  v_unrelated_invoice_id uuid := gen_random_uuid();
  v_loan_id uuid := gen_random_uuid();
  v_installment_loan_id uuid := gen_random_uuid();
  v_installment_id uuid := gen_random_uuid();
  v_plan_id uuid := gen_random_uuid();
  v_subscription_order_id uuid := gen_random_uuid();
  v_voucher_id uuid := gen_random_uuid();
  v_credit_request_id uuid := gen_random_uuid();
  v_request_id uuid;
  v_result jsonb;
  v_repeat jsonb;
  v_invoice_id uuid;
  v_count integer;
  v_value numeric;
  v_rejected boolean;
BEGIN
  INSERT INTO public.clientes(
    id, nome, tipo_pessoa, status, saldo_pontos, pontos_totais,
    saldo_carteira, limite_credito_total, limite_credito_disponivel,
    bonus_boas_vindas_pendente
  ) VALUES
    (v_client_id, 'Cliente Financeiro Final', 'pf', 'ativo', 0, 0, 10, 0, 0, false),
    (v_other_id, 'Outro Cliente Financeiro', 'pf', 'ativo', 0, 0, 0, 0, 0, false),
    (v_bonus_client_id, 'Cliente Bônus Final', 'pf', 'ativo', 0, 0, 0, 0, 0, true);

  v_session := public.gsa_create_session_internal('cliente', v_client_id, 'Cliente Financeiro Final', '{}'::jsonb);
  v_other_session := public.gsa_create_session_internal('cliente', v_other_id, 'Outro Cliente Financeiro', '{}'::jsonb);
  v_bonus_session := public.gsa_create_session_internal('cliente', v_bonus_client_id, 'Cliente Bônus Final', '{}'::jsonb);

  -- VIP: preço, nome e benefícios devem vir do banco; o request_id impede clique duplo.
  INSERT INTO public.client_levels(
    id, nome_nivel, pontos_minimos, pontos_maximos, pontos_por_real,
    preco, benefits, exclusive_benefits
  ) VALUES (
    v_level_id, 'Nível Auditoria ' || left(v_level_id::text, 8), 990000, 999999,
    1, 123.45, '["Benefício real"]'::jsonb, '["Exclusivo real"]'::jsonb
  );
  v_request_id := gen_random_uuid();
  v_result := public.gsa_client_subscribe_vip(
    (v_session ->> 'sessao_id')::uuid, v_session ->> 'session_token',
    v_request_id, v_level_id
  );
  v_repeat := public.gsa_client_subscribe_vip(
    (v_session ->> 'sessao_id')::uuid, v_session ->> 'session_token',
    v_request_id, v_level_id
  );
  IF coalesce((v_repeat ->> 'already_exists')::boolean, false) IS NOT TRUE
     OR v_repeat ->> 'fatura_id' <> v_result ->> 'fatura_id' THEN
    RAISE EXCEPTION 'Assinatura VIP não foi idempotente: %', v_repeat;
  END IF;
  SELECT count(*) INTO v_count
  FROM public.faturas
  WHERE id = (v_result ->> 'fatura_id')::uuid
    AND cliente_id = v_client_id
    AND tipo = 'pacote_nivel'
    AND pacote_nivel_id = v_level_id::text
    AND valor_total = 123.45;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Fatura VIP não usa os dados autoritativos do nível.'; END IF;

  -- Crédito da loja: só as faturas vinculadas ao pedido podem ser substituídas.
  INSERT INTO public.produtos(
    id, codigo_produto, nome, valor, tipo_cliente, status
  ) VALUES (
    v_product_id, 'PRD-AUD-' || left(v_product_id::text, 8), 'Produto Auditoria', 50, 'pf', 'ativo'
  );
  INSERT INTO public.orcamentos(
    id, codigo_orcamento, cliente_id, categoria, produto_id,
    total, status, status_quitacao_credito, valor_quitacao_acordo,
    origem_gsa_store
  ) VALUES
    (v_budget_id, 'ODC-AUD-' || left(v_budget_id::text, 8), v_client_id, 'loja', v_product_id,
      100, 'pago', 'aguardando_pagamento_quitacao', 80, true),
    (v_other_budget_id, 'ODC-OUT-' || left(v_other_budget_id::text, 8), v_client_id, 'loja', v_product_id,
      999, 'pago', NULL, NULL, true);
  INSERT INTO public.ordens_compra(
    id, codigo_ordem, produto_id, cliente_id, status, quantidade, orcamento_id
  ) VALUES (
    v_order_id, 'OC-AUD-' || left(v_order_id::text, 8), v_product_id,
    v_client_id, 'concluido', 2, v_budget_id
  );
  INSERT INTO public.faturas(
    codigo_fatura, cliente_id, orcamento_id, ordem_compra_id,
    valor_total, valor_final_pendente, status, tipo,
    is_amortizacao_credito, data_vencimento
  ) VALUES
    ('FAT-CRE-AUD-1-' || left(v_budget_id::text, 8), v_client_id, v_budget_id, v_order_id,
      50, 50, 'pendente', 'produto', true, current_date + 30),
    ('FAT-CRE-AUD-2-' || left(v_budget_id::text, 8), v_client_id, v_budget_id, v_order_id,
      50, 50, 'pendente', 'produto', true, current_date + 60);
  INSERT INTO public.faturas(
    id, codigo_fatura, cliente_id, orcamento_id, valor_total,
    valor_final_pendente, status, tipo, is_amortizacao_credito, data_vencimento
  ) VALUES (
    v_unrelated_invoice_id, 'FAT-UNRELATED-' || left(v_other_budget_id::text, 8),
    v_client_id, v_other_budget_id, 999, 999, 'pendente', 'produto', true, current_date + 30
  );

  v_result := public.gsa_client_accept_store_credit_settlement(
    (v_session ->> 'sessao_id')::uuid, v_session ->> 'session_token', v_budget_id
  );
  v_invoice_id := (v_result ->> 'fatura_id')::uuid;
  IF (v_result ->> 'valor_original')::numeric <> 100 THEN
    RAISE EXCEPTION 'Quitação de crédito calculou saldo fora do pedido: %', v_result;
  END IF;
  SELECT count(*) INTO v_count FROM public.faturas
  WHERE orcamento_id = v_budget_id AND id <> v_invoice_id AND status = 'cancelado';
  IF v_count <> 2 THEN RAISE EXCEPTION 'Parcelas corretas não foram substituídas pela quitação.'; END IF;
  SELECT count(*) INTO v_count FROM public.faturas
  WHERE id = v_unrelated_invoice_id AND status = 'pendente';
  IF v_count <> 1 THEN RAISE EXCEPTION 'Quitação alterou fatura de outro pedido.'; END IF;
  v_repeat := public.gsa_client_accept_store_credit_settlement(
    (v_session ->> 'sessao_id')::uuid, v_session ->> 'session_token', v_budget_id
  );
  IF coalesce((v_repeat ->> 'already_exists')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Quitação de crédito não foi idempotente.';
  END IF;
  v_rejected := false;
  BEGIN
    PERFORM public.gsa_client_accept_store_credit_settlement(
      (v_other_session ->> 'sessao_id')::uuid, v_other_session ->> 'session_token', v_budget_id
    );
  EXCEPTION WHEN others THEN v_rejected := true;
  END;
  IF v_rejected IS NOT TRUE THEN RAISE EXCEPTION 'Outro cliente aceitou a quitação de crédito.'; END IF;

  UPDATE public.faturas SET data_vencimento = current_date - 1 WHERE id = v_invoice_id;
  PERFORM public.process_expired_quitacoes();
  SELECT count(*) INTO v_count FROM public.faturas
  WHERE orcamento_id = v_budget_id AND id <> v_invoice_id AND status = 'pendente';
  IF v_count <> 2 THEN RAISE EXCEPTION 'Expiração não restaurou as parcelas do crédito.'; END IF;

  -- Empréstimo: quitação suspende somente as parcelas do contrato e é idempotente.
  INSERT INTO public.emprestimos(
    id, codigo_emprestimo, cliente_id, valor_solicitado, valor_aprovado,
    valor_total_financiado, status, valor_quitacao_acordo
  ) VALUES (
    v_loan_id, 'EMP-AUD-' || left(v_loan_id::text, 8), v_client_id,
    200, 200, 200, 'aguardando_pagamento_quitacao', 150
  );
  INSERT INTO public.emprestimo_parcelas(
    emprestimo_id, cliente_id, numero_parcela, valor, data_vencimento, status
  ) VALUES
    (v_loan_id, v_client_id, 1, 100, current_date + 30, 'pendente'),
    (v_loan_id, v_client_id, 2, 100, current_date + 60, 'pendente');
  v_result := public.gsa_client_accept_loan_settlement(
    (v_session ->> 'sessao_id')::uuid, v_session ->> 'session_token', v_loan_id
  );
  SELECT count(*) INTO v_count FROM public.emprestimo_parcelas
  WHERE emprestimo_id = v_loan_id AND numero_parcela > 0 AND status = 'suspensa';
  IF v_count <> 2 THEN RAISE EXCEPTION 'Quitação não suspendeu as parcelas do empréstimo.'; END IF;
  SELECT count(*) INTO v_count FROM public.emprestimo_parcelas
  WHERE emprestimo_id = v_loan_id AND numero_parcela = 0
    AND fatura_id = (v_result ->> 'fatura_id')::uuid;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Parcela de quitação do empréstimo não foi criada.'; END IF;
  v_repeat := public.gsa_client_accept_loan_settlement(
    (v_session ->> 'sessao_id')::uuid, v_session ->> 'session_token', v_loan_id
  );
  IF coalesce((v_repeat ->> 'already_exists')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Quitação de empréstimo não foi idempotente.';
  END IF;

  -- Fatura de parcela individual vinculada à sessão.
  INSERT INTO public.emprestimos(
    id, codigo_emprestimo, cliente_id, valor_solicitado, valor_aprovado,
    valor_total_financiado, status
  ) VALUES (
    v_installment_loan_id, 'EMP-PAR-' || left(v_installment_loan_id::text, 8),
    v_client_id, 40, 40, 40, 'ativo'
  );
  INSERT INTO public.emprestimo_parcelas(
    id, emprestimo_id, cliente_id, numero_parcela, valor, data_vencimento, status
  ) VALUES (
    v_installment_id, v_installment_loan_id, v_client_id, 1, 40, current_date + 20, 'pendente'
  );
  v_result := public.gsa_client_generate_loan_installment_invoice(
    (v_session ->> 'sessao_id')::uuid, v_session ->> 'session_token', v_installment_id
  );
  v_repeat := public.gsa_client_generate_loan_installment_invoice(
    (v_session ->> 'sessao_id')::uuid, v_session ->> 'session_token', v_installment_id
  );
  IF coalesce((v_repeat ->> 'already_exists')::boolean, false) IS NOT TRUE
     OR v_repeat ->> 'fatura_id' <> v_result ->> 'fatura_id' THEN
    RAISE EXCEPTION 'Fatura da parcela não foi idempotente.';
  END IF;

  -- Prorrogação: dois meses geram exatamente duas faturas, mesmo com repetição do request.
  INSERT INTO public.assinaturas(
    id, codigo_assinatura, nome, valor, status, tipo_cliente
  ) VALUES (
    v_plan_id, 'ASS-AUD-' || left(v_plan_id::text, 8), 'Plano Auditoria', 75, 'ativo', 'pf'
  );
  INSERT INTO public.ordens_assinatura(
    id, codigo_ordem, assinatura_id, cliente_id, status,
    prazo_meses, data_vencimento
  ) VALUES (
    v_subscription_order_id, 'OA-AUD-' || left(v_subscription_order_id::text, 8),
    v_plan_id, v_client_id, 'aprovado', 1, current_date
  );
  v_request_id := gen_random_uuid();
  v_result := public.gsa_client_extend_subscription(
    (v_session ->> 'sessao_id')::uuid, v_session ->> 'session_token',
    v_request_id, v_subscription_order_id, 2
  );
  v_repeat := public.gsa_client_extend_subscription(
    (v_session ->> 'sessao_id')::uuid, v_session ->> 'session_token',
    v_request_id, v_subscription_order_id, 10
  );
  IF coalesce((v_repeat ->> 'already_exists')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Prorrogação não foi idempotente.';
  END IF;
  SELECT count(*) INTO v_count FROM public.faturas
  WHERE ordem_assinatura_id = v_subscription_order_id;
  IF v_count <> 2 THEN RAISE EXCEPTION 'Prorrogação gerou quantidade incorreta de faturas: %', v_count; END IF;

  -- Voucher público pode ser usado por clientes diferentes, mas uma única vez por cliente.
  INSERT INTO public.vouchers(
    id, codigo_voucher, nome, tipo, valor, categoria,
    usage_limit, usage_count, status, validade
  ) VALUES (
    v_voucher_id, 'VCH-AUD-' || left(v_voucher_id::text, 8), 'Voucher Auditoria',
    'valor', 25, 'saque', 2, 0, 'ativo', current_date + 5
  );
  v_result := public.gsa_client_redeem_wallet_voucher(
    (v_session ->> 'sessao_id')::uuid, v_session ->> 'session_token', v_voucher_id
  );
  v_repeat := public.gsa_client_redeem_wallet_voucher(
    (v_session ->> 'sessao_id')::uuid, v_session ->> 'session_token', v_voucher_id
  );
  IF coalesce((v_repeat ->> 'already_exists')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Voucher foi resgatado duas vezes pelo mesmo cliente.';
  END IF;
  SELECT count(*) INTO v_count FROM public.gsa_voucher_resgates
  WHERE voucher_id = v_voucher_id AND cliente_id = v_client_id;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Registro único de resgate do voucher não foi respeitado.'; END IF;
  PERFORM public.gsa_client_redeem_wallet_voucher(
    (v_other_session ->> 'sessao_id')::uuid, v_other_session ->> 'session_token', v_voucher_id
  );
  SELECT usage_count INTO v_count FROM public.vouchers WHERE id = v_voucher_id;
  IF v_count <> 2 THEN RAISE EXCEPTION 'Limite global do voucher não foi contabilizado.'; END IF;

  -- Bônus: uma única contabilização, sempre para o ator da sessão.
  v_result := public.gsa_client_process_welcome_bonus(
    (v_bonus_session ->> 'sessao_id')::uuid, v_bonus_session ->> 'session_token'
  );
  IF coalesce((v_result ->> 'processed')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Bônus de boas-vindas não foi processado: %', v_result;
  END IF;
  v_repeat := public.gsa_client_process_welcome_bonus(
    (v_bonus_session ->> 'sessao_id')::uuid, v_bonus_session ->> 'session_token'
  );
  IF coalesce((v_repeat ->> 'processed')::boolean, false) IS TRUE THEN
    RAISE EXCEPTION 'Bônus de boas-vindas foi processado duas vezes.';
  END IF;
  SELECT count(*) INTO v_count FROM (
    SELECT id FROM public.pontos_movimentacoes
    WHERE cliente_id = v_bonus_client_id AND descricao = 'Bônus de Boas-vindas'
    UNION ALL
    SELECT id FROM public.carteira_lancamentos
    WHERE cliente_id = v_bonus_client_id AND descricao = 'Bônus de Boas-vindas'
  ) AS bonus_rows;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Bônus gerou quantidade incorreta de lançamentos: %', v_count; END IF;

  -- Crédito assinado: libera uma vez e calcula disponível sem ignorar uso existente.
  INSERT INTO public.loja_credito_solicitacoes(
    id, cliente_id, tipo_solicitacao, status, limite_aprovado,
    opcao_pagamento_parcelado, data_liberacao_credito
  ) VALUES (
    v_credit_request_id, v_client_id, 'adesao', 'contrato_assinado',
    500, true, current_date
  );
  v_result := public.gsa_client_release_signed_credit(
    (v_session ->> 'sessao_id')::uuid, v_session ->> 'session_token'
  );
  IF (v_result ->> 'liberados')::integer <> 1 THEN
    RAISE EXCEPTION 'Contrato de crédito não foi liberado: %', v_result;
  END IF;
  SELECT limite_credito_total INTO v_value FROM public.clientes WHERE id = v_client_id;
  IF v_value <> 500 THEN RAISE EXCEPTION 'Limite liberado incorreto: %', v_value; END IF;
  v_repeat := public.gsa_client_release_signed_credit(
    (v_session ->> 'sessao_id')::uuid, v_session ->> 'session_token'
  );
  IF (v_repeat ->> 'liberados')::integer <> 0 THEN
    RAISE EXCEPTION 'Contrato de crédito foi liberado duas vezes.';
  END IF;

  IF has_function_privilege('anon', 'public.assinar_area_vip_cliente(jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.aceitar_quitacao_credito_loja(uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.aceitar_quitacao_emprestimo(uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.gerar_fatura_parcela_emprestimo(uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.prorrogar_assinatura_cliente(uuid,uuid,integer)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.resgatar_voucher_carteira(uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.processar_bonus_boas_vindas_seguro(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.suprimir_bonus_boas_vindas_cliente(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.liberar_credito_loja_assinado(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Uma ou mais RPCs legadas continuam executáveis por anon.';
  END IF;
END;
$$;

