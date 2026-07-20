-- Session-bound budget approval, settlement lifecycle and store exchange operations.

ALTER TABLE public.gsa_client_operation_requests
  DROP CONSTRAINT IF EXISTS gsa_client_operation_name_check;
ALTER TABLE public.gsa_client_operation_requests
  ADD CONSTRAINT gsa_client_operation_name_check CHECK (operacao IN (
    'converter_pontos',
    'solicitar_saque',
    'solicitar_transferencia',
    'assinar_area_vip',
    'prorrogar_assinatura',
    'solicitar_troca_loja'
  ));

CREATE OR REPLACE FUNCTION public.gsa_client_approve_budget(
  p_sessao_id uuid,
  p_session_token text,
  p_orcamento_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_budget public.orcamentos%rowtype;
  v_service public.servicos%rowtype;
  v_product public.produtos%rowtype;
  v_plan public.assinaturas%rowtype;
  v_service_order_id uuid;
  v_purchase_order_id uuid;
  v_subscription_order_id uuid;
  v_invoice_id uuid;
  v_demand_id uuid;
  v_type text;
  v_approved_total numeric;
  v_extra_discount numeric := 0;
  v_already_approved boolean := false;
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_client_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  SELECT * INTO v_budget
  FROM public.orcamentos
  WHERE id = p_orcamento_id
    AND cliente_id = v_actor.cliente_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Orçamento não encontrado.'; END IF;

  v_already_approved := v_budget.status = 'aprovado';
  IF NOT v_already_approved AND v_budget.status NOT IN ('aberto', 'em revisão', 'negociação') THEN
    RAISE EXCEPTION 'Este orçamento não pode mais ser aprovado.';
  END IF;

  v_approved_total := round(greatest(coalesce(v_budget.total, 0), 0), 2);
  IF NOT v_already_approved AND v_budget.status = 'negociação'
     AND coalesce(v_budget.proposta_admin_porcentagem, 0) > 0 THEN
    IF v_budget.proposta_admin_porcentagem > 100 THEN
      RAISE EXCEPTION 'Percentual da proposta administrativa inválido.';
    END IF;
    v_approved_total := round(
      v_approved_total * (1 - v_budget.proposta_admin_porcentagem / 100), 2
    );
    v_extra_discount := round(coalesce(v_budget.total, 0) - v_approved_total, 2);
  END IF;
  IF v_approved_total <= 0 THEN RAISE EXCEPTION 'Valor aprovado do orçamento inválido.'; END IF;

  IF NOT v_already_approved THEN
    UPDATE public.orcamentos
    SET status = 'aprovado',
        total = v_approved_total,
        desconto = round(coalesce(desconto, 0) + v_extra_discount, 2)
    WHERE id = v_budget.id;

    IF v_budget.promocao_id IS NOT NULL THEN
      UPDATE public.cliente_promocoes
      SET status = 'usada', orcamento_id = v_budget.id, data_uso = now()
      WHERE promocao_id = v_budget.promocao_id
        AND cliente_id = v_actor.cliente_id
        AND status = 'ativa';
    END IF;
  END IF;

  IF v_budget.categoria = 'servico' OR v_budget.servico_id IS NOT NULL THEN
    v_type := 'servico';
    IF v_budget.servico_id IS NULL THEN RAISE EXCEPTION 'Serviço não informado no orçamento.'; END IF;
    SELECT * INTO v_service FROM public.servicos WHERE id = v_budget.servico_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Serviço do orçamento não encontrado.'; END IF;

    SELECT id INTO v_service_order_id
    FROM public.ordens_servico
    WHERE orcamento_id = v_budget.id
    LIMIT 1;
    IF v_service_order_id IS NULL THEN
      INSERT INTO public.ordens_servico(
        codigo_os, orcamento_id, cliente_id, servico_id, status, data_inicio
      ) VALUES (
        public.gsa_generate_code('OS'), v_budget.id, v_actor.cliente_id,
        v_service.id, 'andamento', now()
      ) RETURNING id INTO v_service_order_id;
    END IF;

    SELECT id INTO v_demand_id
    FROM public.prestador_demandas
    WHERE os_id = v_service_order_id
    ORDER BY created_at
    LIMIT 1;
    IF v_demand_id IS NULL THEN
      INSERT INTO public.prestador_demandas(
        titulo, descricao, os_id, status, codigo_demanda,
        arquivos_briefing, prioridade
      ) VALUES (
        'Serviço: ' || v_service.nome,
        coalesce(v_budget.descricao_solicitacao, v_budget.observacoes_servico, 'Demanda gerada automaticamente após aprovação.'),
        v_service_order_id, 'aberta', public.gsa_generate_code('DEM'),
        coalesce(v_budget.anexos, '[]'::jsonb),
        CASE WHEN v_budget.nivel_prioridade IN ('urgente', 'alta', 'normal', 'baixa')
          THEN v_budget.nivel_prioridade ELSE 'normal' END
      ) RETURNING id INTO v_demand_id;
    END IF;

  ELSIF v_budget.categoria = 'produto' OR v_budget.produto_id IS NOT NULL THEN
    v_type := 'produto';
    IF v_budget.produto_id IS NULL THEN RAISE EXCEPTION 'Produto não informado no orçamento.'; END IF;
    SELECT * INTO v_product FROM public.produtos WHERE id = v_budget.produto_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produto do orçamento não encontrado.'; END IF;

    SELECT id INTO v_purchase_order_id
    FROM public.ordens_compra
    WHERE orcamento_id = v_budget.id
    LIMIT 1;
    IF v_purchase_order_id IS NULL THEN
      INSERT INTO public.ordens_compra(
        codigo_ordem, produto_id, cliente_id, status, quantidade, orcamento_id
      ) VALUES (
        public.gsa_generate_code('OC'), v_product.id, v_actor.cliente_id,
        'em_analise', greatest(coalesce(v_budget.quantidade, 1), 1), v_budget.id
      ) RETURNING id INTO v_purchase_order_id;
    END IF;

    SELECT id INTO v_invoice_id
    FROM public.faturas
    WHERE orcamento_id = v_budget.id
      AND cliente_id = v_actor.cliente_id
      AND status <> 'cancelado'
    ORDER BY created_at
    LIMIT 1;
    IF v_invoice_id IS NULL THEN
      INSERT INTO public.faturas(
        codigo_fatura, ordem_compra_id, orcamento_id, cliente_id,
        valor_total, valor_final_pendente, valor_base_original,
        status, tipo, data_vencimento, gerada_automaticamente, itens_faturados
      ) VALUES (
        public.gsa_generate_code('FAT'), v_purchase_order_id, v_budget.id,
        v_actor.cliente_id, v_approved_total, v_approved_total,
        round(coalesce(v_budget.total, v_approved_total) + v_extra_discount, 2),
        'pendente', 'produto', current_date + 7, true,
        jsonb_build_array(jsonb_build_object(
          'id', v_product.id,
          'codigo', v_product.codigo_produto,
          'descricao', v_product.nome,
          'valor', round(v_approved_total / greatest(coalesce(v_budget.quantidade, 1), 1), 2),
          'quantidade', greatest(coalesce(v_budget.quantidade, 1), 1),
          'subtotal', v_approved_total
        ))
      ) RETURNING id INTO v_invoice_id;
    END IF;

  ELSIF v_budget.categoria = 'assinatura' OR v_budget.assinatura_id IS NOT NULL THEN
    v_type := 'assinatura';
    IF v_budget.assinatura_id IS NULL THEN RAISE EXCEPTION 'Assinatura não informada no orçamento.'; END IF;
    SELECT * INTO v_plan FROM public.assinaturas WHERE id = v_budget.assinatura_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Plano de assinatura do orçamento não encontrado.'; END IF;

    SELECT id INTO v_subscription_order_id
    FROM public.ordens_assinatura
    WHERE orcamento_id = v_budget.id
    LIMIT 1;
    IF v_subscription_order_id IS NULL THEN
      INSERT INTO public.ordens_assinatura(
        codigo_ordem, assinatura_id, cliente_id, status, quantidade,
        prazo_meses, renovacao_automatica, orcamento_id, data_vencimento
      ) VALUES (
        public.gsa_generate_code('OA'), v_plan.id, v_actor.cliente_id,
        'em_analise', greatest(coalesce(v_budget.quantidade, 1), 1),
        greatest(coalesce(v_budget.quantidade_meses, 1), 1), true,
        v_budget.id,
        current_date + make_interval(months => greatest(coalesce(v_budget.quantidade_meses, 1), 1))
      ) RETURNING id INTO v_subscription_order_id;
    END IF;

    SELECT id INTO v_invoice_id
    FROM public.faturas
    WHERE orcamento_id = v_budget.id
      AND cliente_id = v_actor.cliente_id
      AND status <> 'cancelado'
    ORDER BY created_at
    LIMIT 1;
    IF v_invoice_id IS NULL THEN
      INSERT INTO public.faturas(
        codigo_fatura, ordem_assinatura_id, orcamento_id, cliente_id,
        valor_total, valor_final_pendente, valor_base_original,
        status, tipo, data_vencimento, gerada_automaticamente, itens_faturados
      ) VALUES (
        public.gsa_generate_code('FAT'), v_subscription_order_id, v_budget.id,
        v_actor.cliente_id, v_approved_total, v_approved_total,
        round(coalesce(v_budget.total, v_approved_total) + v_extra_discount, 2),
        'pendente', 'assinatura', current_date + 7, true,
        jsonb_build_array(jsonb_build_object(
          'id', v_plan.id,
          'codigo', v_plan.codigo_assinatura,
          'descricao', v_plan.nome,
          'valor', v_approved_total,
          'quantidade', 1,
          'prazo_meses', greatest(coalesce(v_budget.quantidade_meses, 1), 1)
        ))
      ) RETURNING id INTO v_invoice_id;
    END IF;
  ELSE
    RAISE EXCEPTION 'Categoria do orçamento não reconhecida.';
  END IF;

  IF NOT v_already_approved THEN
    INSERT INTO public.orcamento_timeline(
      orcamento_id, cliente_id, ator_id, ator_tipo, tipo, acao,
      status, titulo, descricao, metadata
    ) VALUES (
      v_budget.id, v_actor.cliente_id, v_actor.cliente_id, 'cliente',
      'aprovacao', 'aprovar_orcamento', 'aprovado',
      'Orçamento aprovado pelo cliente',
      'O cliente aprovou o orçamento no valor de R$ ' || to_char(v_approved_total, 'FM999G999G990D00'),
      jsonb_build_object('tipo', v_type, 'valor_aprovado', v_approved_total)
    );
    INSERT INTO public.notificacoes(
      cliente_id, titulo, mensagem, modulo, tab, item_id,
      destinatario_tipo, prioridade, acao_origem, contexto
    ) VALUES
      (v_actor.cliente_id, 'Orçamento aprovado',
        'Seu orçamento ' || coalesce(v_budget.codigo_orcamento, '') || ' foi aprovado com sucesso.',
        'servicos_assinaturas', 'orcamentos', v_budget.id::text,
        'cliente', 'normal', 'aprovar_orcamento', jsonb_build_object('tipo', v_type)),
      (NULL, 'Orçamento aprovado pelo cliente',
        'O orçamento ' || coalesce(v_budget.codigo_orcamento, '') || ' foi aprovado pelo cliente.',
        'vendas', 'aprovados', v_budget.id::text,
        'admin', 'alta', 'aprovar_orcamento', jsonb_build_object('cliente_id', v_actor.cliente_id));
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'already_approved', v_already_approved,
    'tipo', v_type,
    'os_id', v_service_order_id,
    'ordem_compra_id', v_purchase_order_id,
    'ordem_assinatura_id', v_subscription_order_id,
    'fatura_id', v_invoice_id,
    'demanda_id', v_demand_id,
    'total_aprovado', v_approved_total
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_client_request_store_credit_settlement(
  p_sessao_id uuid,
  p_session_token text,
  p_orcamento_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_budget public.orcamentos%rowtype;
  v_count integer;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_client_session_actor(p_sessao_id, p_session_token) LIMIT 1;
  SELECT * INTO v_budget FROM public.orcamentos
  WHERE id = p_orcamento_id AND cliente_id = v_actor.cliente_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido de crédito não encontrado.'; END IF;
  IF v_budget.status_quitacao_credito IN ('analise_quitacao', 'aguardando_pagamento_quitacao') THEN
    RETURN jsonb_build_object('success', true, 'already_exists', true, 'status', v_budget.status_quitacao_credito);
  END IF;
  SELECT count(*) INTO v_count FROM public.faturas f
  WHERE f.cliente_id = v_actor.cliente_id
    AND f.status NOT IN ('pago', 'cancelado')
    AND coalesce(f.is_amortizacao_credito, false)
    AND (f.orcamento_id = v_budget.id OR f.ordem_compra_id IN (
      SELECT id FROM public.ordens_compra WHERE orcamento_id = v_budget.id
    ));
  IF v_count = 0 THEN RAISE EXCEPTION 'Não existem parcelas de crédito pendentes para quitação.'; END IF;
  UPDATE public.orcamentos SET status_quitacao_credito = 'analise_quitacao'
  WHERE id = v_budget.id;
  INSERT INTO public.notificacoes(
    cliente_id, titulo, mensagem, modulo, tab, item_id,
    destinatario_tipo, prioridade, acao_origem, contexto
  ) VALUES (
    NULL, 'Solicitação de quitação de crédito',
    'O cliente solicitou a quitação antecipada do pedido ' || coalesce(v_budget.codigo_orcamento, '') || '.',
    'credito_loja', 'quitacoes', v_budget.id::text,
    'admin', 'alta', 'solicitar_quitacao_credito', jsonb_build_object('cliente_id', v_actor.cliente_id)
  );
  RETURN jsonb_build_object('success', true, 'already_exists', false, 'status', 'analise_quitacao');
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_client_reject_store_credit_settlement(
  p_sessao_id uuid,
  p_session_token text,
  p_orcamento_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_budget public.orcamentos%rowtype;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_client_session_actor(p_sessao_id, p_session_token) LIMIT 1;
  SELECT * INTO v_budget FROM public.orcamentos
  WHERE id = p_orcamento_id AND cliente_id = v_actor.cliente_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido de crédito não encontrado.'; END IF;
  IF coalesce(v_budget.status_quitacao_credito, '') <> 'aguardando_pagamento_quitacao' THEN
    RETURN jsonb_build_object('success', true, 'already_processed', true);
  END IF;
  UPDATE public.orcamentos
  SET status_quitacao_credito = NULL, valor_quitacao_acordo = NULL
  WHERE id = v_budget.id;
  INSERT INTO public.notificacoes(
    cliente_id, titulo, mensagem, modulo, tab, item_id,
    destinatario_tipo, acao_origem, contexto
  ) VALUES (
    NULL, 'Oferta de quitação recusada',
    'O cliente recusou a oferta de quitação do pedido ' || coalesce(v_budget.codigo_orcamento, '') || '.',
    'credito_loja', 'quitacoes', v_budget.id::text,
    'admin', 'recusar_quitacao_credito', jsonb_build_object('cliente_id', v_actor.cliente_id)
  );
  RETURN jsonb_build_object('success', true, 'already_processed', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_client_request_loan_settlement(
  p_sessao_id uuid,
  p_session_token text,
  p_emprestimo_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_loan public.emprestimos%rowtype;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_client_session_actor(p_sessao_id, p_session_token) LIMIT 1;
  SELECT * INTO v_loan FROM public.emprestimos
  WHERE id = p_emprestimo_id AND cliente_id = v_actor.cliente_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Empréstimo não encontrado.'; END IF;
  IF v_loan.status IN ('analise_quitacao', 'aguardando_pagamento_quitacao') THEN
    RETURN jsonb_build_object('success', true, 'already_exists', true, 'status', v_loan.status);
  END IF;
  IF v_loan.status <> 'ativo' THEN RAISE EXCEPTION 'Este empréstimo não está apto para quitação antecipada.'; END IF;
  UPDATE public.emprestimos SET status = 'analise_quitacao', updated_at = now()
  WHERE id = v_loan.id;
  INSERT INTO public.emprestimo_historico(
    emprestimo_id, orcamento_id, tipo_acao, descricao, usuario_tipo, usuario_id
  ) VALUES (
    v_loan.id, v_loan.orcamento_id, 'solicitacao_quitacao',
    'Cliente solicitou quitação antecipada', 'cliente', v_actor.cliente_id::text
  );
  INSERT INTO public.notificacoes(
    cliente_id, titulo, mensagem, modulo, tab, item_id,
    destinatario_tipo, prioridade, acao_origem, contexto
  ) VALUES (
    NULL, 'Solicitação de quitação de empréstimo',
    'O cliente solicitou a quitação do empréstimo ' || coalesce(v_loan.codigo_emprestimo, '') || '.',
    'emprestimos', 'quitacoes', v_loan.id::text,
    'admin', 'alta', 'solicitar_quitacao_emprestimo', jsonb_build_object('cliente_id', v_actor.cliente_id)
  );
  RETURN jsonb_build_object('success', true, 'already_exists', false, 'status', 'analise_quitacao');
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_client_reject_loan_settlement(
  p_sessao_id uuid,
  p_session_token text,
  p_emprestimo_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_loan public.emprestimos%rowtype;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_client_session_actor(p_sessao_id, p_session_token) LIMIT 1;
  SELECT * INTO v_loan FROM public.emprestimos
  WHERE id = p_emprestimo_id AND cliente_id = v_actor.cliente_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Empréstimo não encontrado.'; END IF;
  IF v_loan.status <> 'aguardando_pagamento_quitacao' THEN
    RETURN jsonb_build_object('success', true, 'already_processed', true);
  END IF;
  UPDATE public.emprestimos
  SET status = 'ativo', valor_quitacao_acordo = NULL, updated_at = now()
  WHERE id = v_loan.id;
  INSERT INTO public.emprestimo_historico(
    emprestimo_id, orcamento_id, tipo_acao, descricao, usuario_tipo, usuario_id
  ) VALUES (
    v_loan.id, v_loan.orcamento_id, 'recusa_quitacao',
    'Cliente recusou a oferta de quitação antecipada', 'cliente', v_actor.cliente_id::text
  );
  INSERT INTO public.notificacoes(
    cliente_id, titulo, mensagem, modulo, tab, item_id,
    destinatario_tipo, acao_origem, contexto
  ) VALUES (
    NULL, 'Oferta de quitação recusada',
    'O cliente recusou a oferta do empréstimo ' || coalesce(v_loan.codigo_emprestimo, '') || '.',
    'emprestimos', 'quitacoes', v_loan.id::text,
    'admin', 'recusar_quitacao_emprestimo', jsonb_build_object('cliente_id', v_actor.cliente_id)
  );
  RETURN jsonb_build_object('success', true, 'already_processed', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_client_request_store_exchange(
  p_sessao_id uuid,
  p_session_token text,
  p_request_id uuid,
  p_orcamento_id uuid,
  p_tipo text,
  p_motivo text,
  p_imagens_anexo jsonb,
  p_metodo_entrega text,
  p_itens_devolvidos jsonb,
  p_opcao_substituicao text,
  p_novos_produtos jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_budget public.orcamentos%rowtype;
  v_result jsonb;
  v_inserted uuid;
  v_exchange_id uuid;
  v_code text;
  v_type text := lower(trim(coalesce(p_tipo, '')));
  v_reason text := trim(coalesce(p_motivo, ''));
  v_delivery_method text := lower(trim(coalesce(p_metodo_entrega, '')));
  v_replacement_option text := lower(trim(coalesce(p_opcao_substituicao, '')));
  v_item_id uuid;
  v_item record;
  v_new_item jsonb;
  v_new_product public.produtos%rowtype;
  v_quantity integer;
  v_unit_value numeric;
  v_exchange_credit numeric := 0;
  v_new_total numeric := 0;
  v_difference numeric := 0;
  v_returned_description text := '';
  v_new_description text := '';
  v_detailed_description text;
  v_delivery_date timestamptz;
  v_image text;
  v_count integer;
BEGIN
  IF p_request_id IS NULL OR p_orcamento_id IS NULL THEN
    RAISE EXCEPTION 'Identificador da operação e pedido são obrigatórios.';
  END IF;
  IF v_type NOT IN ('troca', 'devolucao') THEN RAISE EXCEPTION 'Tipo de solicitação inválido.'; END IF;
  IF length(v_reason) < 10 OR length(v_reason) > 2000 THEN
    RAISE EXCEPTION 'O motivo deve ter entre 10 e 2000 caracteres.';
  END IF;
  IF v_delivery_method NOT IN ('correios', 'pessoalmente') THEN
    RAISE EXCEPTION 'Método de entrega inválido.';
  END IF;
  IF jsonb_typeof(coalesce(p_imagens_anexo, 'null'::jsonb)) <> 'array'
     OR jsonb_array_length(p_imagens_anexo) < 1
     OR jsonb_array_length(p_imagens_anexo) > 5 THEN
    RAISE EXCEPTION 'Anexe de 1 a 5 imagens válidas.';
  END IF;
  IF jsonb_typeof(coalesce(p_itens_devolvidos, 'null'::jsonb)) <> 'array'
     OR jsonb_array_length(p_itens_devolvidos) = 0 THEN
    RAISE EXCEPTION 'Selecione pelo menos um item do pedido.';
  END IF;

  SELECT * INTO v_actor FROM public.gsa_client_session_actor(p_sessao_id, p_session_token) LIMIT 1;
  INSERT INTO public.gsa_client_operation_requests(request_id, cliente_id, operacao)
  VALUES (p_request_id, v_actor.cliente_id, 'solicitar_troca_loja')
  ON CONFLICT (request_id) DO NOTHING
  RETURNING request_id INTO v_inserted;
  IF v_inserted IS NULL THEN
    SELECT resultado INTO v_result FROM public.gsa_client_operation_requests
    WHERE request_id = p_request_id
      AND cliente_id = v_actor.cliente_id
      AND operacao = 'solicitar_troca_loja';
    IF NOT FOUND THEN RAISE EXCEPTION 'Identificador da operação já utilizado.'; END IF;
    IF v_result IS NULL THEN RAISE EXCEPTION 'Operação ainda em processamento.'; END IF;
    RETURN v_result || jsonb_build_object('already_exists', true);
  END IF;

  FOR v_image IN SELECT value FROM jsonb_array_elements_text(p_imagens_anexo) AS image(value)
  LOOP
    IF position('/storage/v1/object/public/gsa-store-images/trocas/' || v_actor.cliente_id::text || '/' IN v_image) = 0 THEN
      RAISE EXCEPTION 'Uma das imagens não pertence ao diretório seguro do cliente.';
    END IF;
  END LOOP;

  SELECT * INTO v_budget FROM public.orcamentos
  WHERE id = p_orcamento_id
    AND cliente_id = v_actor.cliente_id
    AND coalesce(origem_gsa_store, false)
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido da loja não encontrado.'; END IF;
  IF v_budget.status <> 'pago' THEN RAISE EXCEPTION 'Somente pedidos pagos podem ser trocados ou devolvidos.'; END IF;

  SELECT coalesce(v_budget.data_entrega, max(oc.data_conclusao), v_budget.data_criacao)
  INTO v_delivery_date
  FROM public.ordens_compra oc
  WHERE oc.orcamento_id = v_budget.id
    AND oc.cliente_id = v_actor.cliente_id
    AND oc.status = 'concluido';
  IF v_delivery_date IS NULL THEN RAISE EXCEPTION 'O pedido ainda não foi concluído.'; END IF;
  IF v_delivery_date < now() - interval '7 days' THEN
    RAISE EXCEPTION 'O prazo de 7 dias para troca ou devolução expirou.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.loja_solicitacoes WHERE orcamento_origem_id = v_budget.id) THEN
    RAISE EXCEPTION 'Este pedido já possui uma solicitação de troca ou devolução.';
  END IF;

  FOR v_item_id IN
    SELECT DISTINCT value::uuid
    FROM jsonb_array_elements_text(p_itens_devolvidos) AS selected(value)
  LOOP
    SELECT oc.id, oc.produto_id, oc.quantidade, oc.status,
           p.nome, p.valor, p.codigo_produto
    INTO v_item
    FROM public.ordens_compra oc
    JOIN public.produtos p ON p.id = oc.produto_id
    WHERE oc.id = v_item_id
      AND oc.orcamento_id = v_budget.id
      AND oc.cliente_id = v_actor.cliente_id
      AND oc.status = 'concluido';
    IF NOT FOUND THEN RAISE EXCEPTION 'Item selecionado não pertence ao pedido concluído.'; END IF;

    SELECT valor_unitario INTO v_unit_value
    FROM public.loja_pedido_itens
    WHERE orcamento_id = v_budget.id
      AND cliente_id = v_actor.cliente_id
      AND tipo = 'produto'
      AND produto_id = v_item.produto_id
    ORDER BY created_at
    LIMIT 1;
    v_unit_value := round(coalesce(v_unit_value, v_item.valor), 2);
    v_exchange_credit := v_exchange_credit + v_unit_value * greatest(coalesce(v_item.quantidade, 1), 1);
    v_returned_description := v_returned_description || '- ' || v_item.nome || ' x'
      || greatest(coalesce(v_item.quantidade, 1), 1)::text || ' (R$ '
      || to_char(v_unit_value, 'FM999G999G990D00') || ')' || E'\n';
  END LOOP;
  v_exchange_credit := round(v_exchange_credit, 2);
  IF v_exchange_credit <= 0 THEN RAISE EXCEPTION 'Nenhum item válido para devolução foi encontrado.'; END IF;

  IF v_type = 'devolucao' THEN
    v_replacement_option := '';
    v_new_description := 'Nenhum (solicitação de devolução/estorno)';
  ELSE
    IF v_replacement_option = 'mesmo_produto' THEN
      v_new_total := v_exchange_credit;
      v_new_description := 'Troca pelos mesmos produtos';
    ELSIF v_replacement_option = 'outro_produto' THEN
      IF jsonb_typeof(coalesce(p_novos_produtos, 'null'::jsonb)) <> 'array'
         OR jsonb_array_length(p_novos_produtos) = 0 THEN
        RAISE EXCEPTION 'Selecione pelo menos um produto substituto.';
      END IF;
      FOR v_new_item IN SELECT value FROM jsonb_array_elements(p_novos_produtos) AS replacement(value)
      LOOP
        v_quantity := coalesce((v_new_item ->> 'quantidade')::integer, 0);
        IF v_quantity < 1 OR v_quantity > 100 THEN RAISE EXCEPTION 'Quantidade de produto substituto inválida.'; END IF;
        SELECT * INTO v_new_product FROM public.produtos
        WHERE id = (v_new_item ->> 'produto_id')::uuid
          AND status = 'ativo'
          AND coalesce(visivel_na_loja, false);
        IF NOT FOUND THEN RAISE EXCEPTION 'Produto substituto indisponível.'; END IF;
        IF coalesce(v_new_product.controle_estoque, false)
           AND coalesce(v_new_product.estoque_disponivel, v_new_product.estoque, 0) < v_quantity THEN
          RAISE EXCEPTION 'Estoque insuficiente para o produto substituto %.', v_new_product.nome;
        END IF;
        v_new_total := v_new_total + round(v_new_product.valor, 2) * v_quantity;
        v_new_description := v_new_description || '- ' || v_new_product.nome || ' x'
          || v_quantity::text || ' (R$ ' || to_char(v_new_product.valor, 'FM999G999G990D00') || ')' || E'\n';
      END LOOP;
    ELSE
      RAISE EXCEPTION 'Opção de substituição inválida.';
    END IF;
  END IF;
  v_new_total := round(v_new_total, 2);
  v_difference := round(v_new_total - v_exchange_credit, 2);
  IF v_type = 'troca' AND v_difference < 0 THEN
    RAISE EXCEPTION 'O valor dos produtos substitutos deve ser igual ou maior ao crédito da troca.';
  END IF;

  v_detailed_description :=
    'TIPO DA SOLICITAÇÃO: ' || CASE WHEN v_type = 'troca'
      THEN 'Troca (' || CASE WHEN v_replacement_option = 'mesmo_produto' THEN 'mesmos produtos' ELSE 'outros produtos' END || ')'
      ELSE 'Devolução' END || E'\n' ||
    'PEDIDO DE ORIGEM: #' || coalesce(v_budget.codigo_orcamento, '') || E'\n\n' ||
    '--- ITENS PARA DEVOLUÇÃO ---' || E'\n' || v_returned_description ||
    'Crédito de Troca: R$ ' || to_char(v_exchange_credit, 'FM999G999G990D00') || E'\n\n' ||
    '--- NOVOS PRODUTOS SUBSTITUTOS ---' || E'\n' || v_new_description || E'\n' ||
    'Total Substitutos: R$ ' || to_char(v_new_total, 'FM999G999G990D00') || E'\n\n' ||
    '--- RESUMO FINANCEIRO ---' || E'\n' ||
    'Valor da Diferença: R$ ' || to_char(greatest(v_difference, 0), 'FM999G999G990D00');

  v_code := public.gsa_generate_code('TRC');
  INSERT INTO public.loja_solicitacoes(
    codigo_solicitacao, cliente_id, orcamento_origem_id, tipo, motivo,
    imagens_anexo, status, descricao_detalhada, valor_diferenca,
    metodo_entrega, historico_status
  ) VALUES (
    v_code, v_actor.cliente_id, v_budget.id, v_type, v_reason,
    p_imagens_anexo, 'em_analise', v_detailed_description,
    greatest(v_difference, 0), v_delivery_method,
    jsonb_build_object('solicitado', now())
  ) RETURNING id INTO v_exchange_id;

  v_result := jsonb_build_object(
    'success', true, 'already_exists', false,
    'solicitacao_id', v_exchange_id, 'codigo_solicitacao', v_code,
    'orcamento_id', v_budget.id, 'credito_troca', v_exchange_credit,
    'valor_novos_produtos', v_new_total, 'valor_diferenca', greatest(v_difference, 0)
  );
  UPDATE public.gsa_client_operation_requests
  SET resultado = v_result, completed_at = now()
  WHERE request_id = p_request_id;

  INSERT INTO public.notificacoes(
    cliente_id, titulo, mensagem, modulo, tab, item_id,
    destinatario_tipo, prioridade, acao_origem, contexto
  ) VALUES
    (v_actor.cliente_id, 'Solicitação recebida',
      'Sua solicitação ' || v_code || ' foi enviada para análise.',
      'gsa_store', 'trocas', v_exchange_id::text,
      'cliente', 'normal', 'solicitar_troca', jsonb_build_object('orcamento_id', v_budget.id)),
    (NULL, 'Nova solicitação de loja',
      'O cliente solicitou ' || CASE WHEN v_type = 'troca' THEN 'troca' ELSE 'devolução' END
        || ' para o pedido ' || coalesce(v_budget.codigo_orcamento, '') || '.',
      'gsa_store', 'trocas', v_exchange_id::text,
      'admin', 'alta', 'solicitar_troca', jsonb_build_object('cliente_id', v_actor.cliente_id));

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_client_submit_exchange_tracking(
  p_sessao_id uuid,
  p_session_token text,
  p_solicitacao_id uuid,
  p_codigo_rastreio text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_request public.loja_solicitacoes%rowtype;
  v_tracking text := upper(trim(coalesce(p_codigo_rastreio, '')));
BEGIN
  IF v_tracking !~ '^[A-Z0-9._/-]{5,100}$' THEN RAISE EXCEPTION 'Código de rastreio inválido.'; END IF;
  SELECT * INTO v_actor FROM public.gsa_client_session_actor(p_sessao_id, p_session_token) LIMIT 1;
  SELECT * INTO v_request FROM public.loja_solicitacoes
  WHERE id = p_solicitacao_id AND cliente_id = v_actor.cliente_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  IF v_request.metodo_entrega <> 'correios' THEN RAISE EXCEPTION 'Esta solicitação não utiliza envio pelos Correios.'; END IF;
  IF v_request.status = 'devolucao_postada' AND v_request.rastreio_cliente = v_tracking THEN
    RETURN jsonb_build_object('success', true, 'already_exists', true, 'codigo_rastreio', v_tracking);
  END IF;
  IF v_request.status <> 'aguardando_devolucao' THEN
    RAISE EXCEPTION 'A solicitação não está aguardando o envio da devolução.';
  END IF;
  UPDATE public.loja_solicitacoes
  SET status = 'devolucao_postada', rastreio_cliente = v_tracking,
      updated_at = now(),
      historico_status = coalesce(historico_status, '{}'::jsonb)
        || jsonb_build_object('devolucao_postada', now())
  WHERE id = v_request.id;
  INSERT INTO public.notificacoes(
    cliente_id, titulo, mensagem, modulo, tab, item_id,
    destinatario_tipo, prioridade, acao_origem, contexto
  ) VALUES (
    NULL, 'Devolução postada pelo cliente',
    'O cliente informou o rastreio ' || v_tracking || ' para a solicitação ' || v_request.codigo_solicitacao || '.',
    'gsa_store', 'trocas', v_request.id::text,
    'admin', 'alta', 'enviar_rastreio_troca', jsonb_build_object('cliente_id', v_actor.cliente_id)
  );
  RETURN jsonb_build_object('success', true, 'already_exists', false, 'codigo_rastreio', v_tracking);
END;
$$;

REVOKE ALL ON FUNCTION public.aprovar_orcamento_cliente(uuid, uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.solicitar_troca(json) FROM public, anon, authenticated;

REVOKE ALL ON FUNCTION public.gsa_client_approve_budget(uuid, text, uuid) FROM public;
REVOKE ALL ON FUNCTION public.gsa_client_request_store_credit_settlement(uuid, text, uuid) FROM public;
REVOKE ALL ON FUNCTION public.gsa_client_reject_store_credit_settlement(uuid, text, uuid) FROM public;
REVOKE ALL ON FUNCTION public.gsa_client_request_loan_settlement(uuid, text, uuid) FROM public;
REVOKE ALL ON FUNCTION public.gsa_client_reject_loan_settlement(uuid, text, uuid) FROM public;
REVOKE ALL ON FUNCTION public.gsa_client_request_store_exchange(uuid, text, uuid, uuid, text, text, jsonb, text, jsonb, text, jsonb) FROM public;
REVOKE ALL ON FUNCTION public.gsa_client_submit_exchange_tracking(uuid, text, uuid, text) FROM public;

GRANT EXECUTE ON FUNCTION public.gsa_client_approve_budget(uuid, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_client_request_store_credit_settlement(uuid, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_client_reject_store_credit_settlement(uuid, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_client_request_loan_settlement(uuid, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_client_reject_loan_settlement(uuid, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_client_request_store_exchange(uuid, text, uuid, uuid, text, text, jsonb, text, jsonb, text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_client_submit_exchange_tracking(uuid, text, uuid, text) TO anon, authenticated;

