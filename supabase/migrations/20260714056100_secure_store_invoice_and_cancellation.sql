-- Session-bound invoice creation and order cancellation for GSA Store.

CREATE OR REPLACE FUNCTION public.gsa_client_generate_store_invoice(
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
  v_order public.orcamentos%rowtype;
  v_invoice public.faturas%rowtype;
  v_items jsonb := '[]'::jsonb;
  v_first_purchase uuid;
  v_first_subscription uuid;
  v_first_service uuid;
  v_type text;
  v_code text;
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_client_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  SELECT * INTO v_order
  FROM public.orcamentos
  WHERE id = p_orcamento_id
    AND cliente_id = v_actor.cliente_id
    AND origem_gsa_store IS TRUE
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido da GSA Store não encontrado.'; END IF;
  IF v_order.status = 'cancelado' THEN RAISE EXCEPTION 'Pedido cancelado não pode gerar fatura.'; END IF;

  SELECT * INTO v_invoice
  FROM public.faturas
  WHERE cliente_id = v_actor.cliente_id
    AND (
      orcamento_id = p_orcamento_id
      OR codigo_fatura = 'FAT-LOJA-' || coalesce(v_order.codigo_orcamento, p_orcamento_id::text)
    )
    AND status <> 'cancelado'
  ORDER BY created_at, id
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_exists', true,
      'fatura_id', v_invoice.id,
      'codigo_fatura', v_invoice.codigo_fatura,
      'status', v_invoice.status
    );
  END IF;

  IF v_order.forma_pagamento_loja = 'credito_loja' THEN
    RAISE EXCEPTION 'As faturas deste pedido de Crédito GSA deveriam ter sido geradas no checkout.';
  END IF;
  IF coalesce(v_order.total, 0) <= 0 THEN
    RAISE EXCEPTION 'Este pedido não possui saldo pendente para faturar.';
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', item.id,
    'codigo', item.codigo,
    'descricao', item.nome,
    'valor_unitario', item.valor_unitario,
    'quantidade', item.quantidade,
    'subtotal', item.subtotal,
    'tipo', item.tipo,
    'is_brinde', item.is_brinde,
    'promocao_id', item.promocao_id,
    'prazo_meses', item.prazo_meses
  ) ORDER BY item.created_at, item.id), '[]'::jsonb)
  INTO v_items
  FROM public.loja_pedido_itens item
  WHERE item.orcamento_id = p_orcamento_id;

  IF jsonb_array_length(v_items) = 0 THEN
    SELECT coalesce(jsonb_agg(entry ORDER BY entry ->> 'tipo', entry ->> 'descricao'), '[]'::jsonb)
    INTO v_items
    FROM (
      SELECT jsonb_build_object(
        'id', oc.id, 'codigo', coalesce(p.codigo_produto, 'PRODUTO'),
        'descricao', coalesce(p.nome, 'Produto'), 'valor_unitario', coalesce(p.valor, 0),
        'quantidade', coalesce(oc.quantidade, 1),
        'subtotal', round(coalesce(p.valor, 0) * coalesce(oc.quantidade, 1), 2), 'tipo', 'produto'
      ) AS entry
      FROM public.ordens_compra oc
      LEFT JOIN public.produtos p ON p.id = oc.produto_id
      WHERE oc.orcamento_id = p_orcamento_id
      UNION ALL
      SELECT jsonb_build_object(
        'id', oa.id, 'codigo', coalesce(a.codigo_assinatura, 'ASSINATURA'),
        'descricao', coalesce(a.nome, 'Assinatura'), 'valor_unitario', coalesce(a.valor, 0),
        'quantidade', coalesce(oa.quantidade, 1),
        'subtotal', round(coalesce(a.valor, 0) * coalesce(oa.quantidade, 1), 2), 'tipo', 'assinatura',
        'prazo_meses', oa.prazo_meses
      ) AS entry
      FROM public.ordens_assinatura oa
      LEFT JOIN public.assinaturas a ON a.id = oa.assinatura_id
      WHERE oa.orcamento_id = p_orcamento_id
      UNION ALL
      SELECT jsonb_build_object(
        'id', os.id, 'codigo', coalesce(s.codigo_servico, 'SERVICO'),
        'descricao', coalesce(s.nome, v_order.titulo_solicitacao, 'Serviço'),
        'valor_unitario', CASE WHEN count(*) OVER () > 0
          THEN round(coalesce(v_order.valor_servico, 0) / count(*) OVER (), 2) ELSE 0 END,
        'quantidade', 1,
        'subtotal', CASE WHEN count(*) OVER () > 0
          THEN round(coalesce(v_order.valor_servico, 0) / count(*) OVER (), 2) ELSE 0 END,
        'tipo', 'servico'
      ) AS entry
      FROM public.ordens_servico os
      LEFT JOIN public.servicos s ON s.id = os.servico_id
      WHERE os.orcamento_id = p_orcamento_id
    ) AS legacy_items;
  END IF;

  IF jsonb_array_length(v_items) = 0 THEN
    v_items := jsonb_build_array(jsonb_build_object(
      'id', p_orcamento_id,
      'codigo', coalesce(v_order.codigo_orcamento, 'PEDIDO'),
      'descricao', coalesce(v_order.titulo_solicitacao, 'Pedido GSA Store'),
      'valor_unitario', coalesce(v_order.subtotal_itens, v_order.total),
      'quantidade', 1,
      'subtotal', coalesce(v_order.subtotal_itens, v_order.total),
      'tipo', 'produto'
    ));
  END IF;

  SELECT id INTO v_first_purchase FROM public.ordens_compra
  WHERE orcamento_id = p_orcamento_id ORDER BY data_criacao, id LIMIT 1;
  SELECT id INTO v_first_subscription FROM public.ordens_assinatura
  WHERE orcamento_id = p_orcamento_id ORDER BY data_criacao, id LIMIT 1;
  SELECT id INTO v_first_service FROM public.ordens_servico
  WHERE orcamento_id = p_orcamento_id ORDER BY data_inicio, id LIMIT 1;

  v_type := CASE
    WHEN v_first_purchase IS NOT NULL THEN 'produto'
    WHEN v_first_subscription IS NOT NULL THEN 'assinatura'
    ELSE 'servico'
  END;
  v_code := 'FAT-LOJA-' || coalesce(v_order.codigo_orcamento, p_orcamento_id::text);

  INSERT INTO public.faturas(
    cliente_id, orcamento_id, codigo_fatura,
    ordem_compra_id, ordem_assinatura_id, os_id,
    valor_total, valor_final_pendente, status, tipo,
    itens_faturados, valor_base_original,
    desconto_promocional_aplicado, desconto_voucher_aplicado,
    desconto_pontos_aplicado, abatimento_carteira_aplicado,
    acrescimo_manual, data_emissao, data_vencimento,
    gerada_automaticamente, observacoes
  ) VALUES (
    v_actor.cliente_id, p_orcamento_id, v_code,
    v_first_purchase, v_first_subscription, v_first_service,
    round(v_order.total, 2), round(v_order.total, 2), 'pendente', v_type,
    v_items, coalesce(nullif(v_order.subtotal_itens, 0), v_order.total),
    coalesce(v_order.desconto_promocional, 0), coalesce(v_order.desconto_cupom, 0),
    coalesce(v_order.desconto_pontos, 0), coalesce(v_order.abatimento_carteira, 0),
    coalesce(v_order.acrescimo, 0), current_date, current_date + 7,
    true, 'Fatura do pedido ' || coalesce(v_order.codigo_orcamento, p_orcamento_id::text)
  ) RETURNING * INTO v_invoice;

  INSERT INTO public.orcamento_timeline(
    orcamento_id, cliente_id, ator_id, ator_tipo, tipo, acao,
    status, titulo, descricao, metadata
  ) VALUES (
    p_orcamento_id, v_actor.cliente_id, v_actor.cliente_id, 'cliente',
    'fatura', 'gerar_fatura', v_order.status,
    'Fatura gerada', 'O cliente iniciou o pagamento do pedido.',
    jsonb_build_object('fatura_id', v_invoice.id, 'codigo_fatura', v_invoice.codigo_fatura)
  );

  RETURN jsonb_build_object(
    'success', true,
    'already_exists', false,
    'fatura_id', v_invoice.id,
    'codigo_fatura', v_invoice.codigo_fatura,
    'status', v_invoice.status
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_client_cancel_store_order(
  p_sessao_id uuid,
  p_session_token text,
  p_orcamento_id uuid,
  p_motivo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_client public.clientes%rowtype;
  v_order public.orcamentos%rowtype;
  v_reason text := left(trim(coalesce(p_motivo, '')), 500);
  v_has_normalized_items boolean;
  v_has_paid_invoice boolean;
  v_paid_external numeric := 0;
  v_points_discount numeric := 0;
  v_points_to_restore integer := 0;
  v_wallet_to_restore numeric := 0;
  v_new_wallet numeric;
  v_new_points integer;
  v_limit_before numeric;
  v_limit_after numeric;
  v_first_purchase uuid;
  v_first_subscription uuid;
  v_refund_id uuid;
  v_refund_code text;
BEGIN
  IF length(v_reason) < 3 THEN RAISE EXCEPTION 'Informe o motivo do cancelamento.'; END IF;

  SELECT * INTO v_actor
  FROM public.gsa_client_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  SELECT * INTO v_order
  FROM public.orcamentos
  WHERE id = p_orcamento_id
    AND cliente_id = v_actor.cliente_id
    AND origem_gsa_store IS TRUE
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido da GSA Store não encontrado.'; END IF;
  IF v_order.status = 'cancelado' THEN
    RETURN jsonb_build_object('success', true, 'already_cancelled', true, 'orcamento_id', v_order.id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ordens_compra
    WHERE orcamento_id = p_orcamento_id AND status IN ('em_expedicao', 'em_transporte', 'concluido')
  ) OR EXISTS (
    SELECT 1 FROM public.ordens_servico
    WHERE orcamento_id = p_orcamento_id AND status IN ('andamento', 'concluido')
  ) OR EXISTS (
    SELECT 1 FROM public.ordens_assinatura
    WHERE orcamento_id = p_orcamento_id AND status = 'concluido'
  ) THEN
    RAISE EXCEPTION 'Este pedido já está em execução ou entrega. Use o fluxo de troca, devolução ou suporte.';
  END IF;

  SELECT * INTO v_client FROM public.clientes WHERE id = v_actor.cliente_id FOR UPDATE;

  SELECT EXISTS(
    SELECT 1 FROM public.loja_pedido_itens WHERE orcamento_id = p_orcamento_id
  ) INTO v_has_normalized_items;

  IF v_has_normalized_items THEN
    UPDATE public.produtos p
    SET estoque_disponivel = p.estoque_disponivel + quantities.quantity
    FROM (
      SELECT item.produto_id, sum(item.quantidade)::integer AS quantity
      FROM public.loja_pedido_itens item
      WHERE item.orcamento_id = p_orcamento_id
        AND item.tipo = 'produto'
        AND item.produto_id IS NOT NULL
      GROUP BY item.produto_id
    ) AS quantities
    WHERE p.id = quantities.produto_id
      AND coalesce(p.controle_estoque, false);
  ELSE
    UPDATE public.produtos p
    SET estoque_disponivel = p.estoque_disponivel + quantities.quantity
    FROM (
      SELECT oc.produto_id, sum(coalesce(oc.quantidade, 1))::integer AS quantity
      FROM public.ordens_compra oc
      WHERE oc.orcamento_id = p_orcamento_id
      GROUP BY oc.produto_id
    ) AS quantities
    WHERE p.id = quantities.produto_id
      AND coalesce(p.controle_estoque, false);
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.faturas f
    WHERE f.orcamento_id = p_orcamento_id AND f.status = 'pago'
  ) INTO v_has_paid_invoice;

  IF v_order.forma_pagamento_loja = 'credito_loja' AND v_has_paid_invoice THEN
    RAISE EXCEPTION 'Há parcela do Crédito GSA já paga. Solicite cancelamento e acerto pelo fluxo de suporte.';
  END IF;

  SELECT coalesce(sum(f.desconto_pontos_aplicado), 0),
         coalesce(sum(f.abatimento_carteira_aplicado), 0)
  INTO v_points_discount, v_wallet_to_restore
  FROM public.faturas f
  WHERE f.orcamento_id = p_orcamento_id
    AND f.status <> 'cancelado';

  v_points_discount := greatest(v_points_discount, coalesce(v_order.desconto_pontos, 0));
  v_wallet_to_restore := greatest(v_wallet_to_restore, coalesce(v_order.abatimento_carteira, 0));
  v_points_to_restore := round(v_points_discount * 100)::integer;

  IF v_points_to_restore > 0 THEN
    v_new_points := coalesce(v_client.saldo_pontos, 0) + v_points_to_restore;
    UPDATE public.clientes SET saldo_pontos = v_new_points WHERE id = v_actor.cliente_id;
    INSERT INTO public.pontos_movimentacoes(
      cliente_id, tipo, pontos, saldo_apos, descricao, valor_convertido
    ) VALUES (
      v_actor.cliente_id, 'estorno', v_points_to_restore, v_new_points,
      'Estorno de pontos do pedido cancelado #' || coalesce(v_order.codigo_orcamento, v_order.id::text),
      v_points_discount
    );
    INSERT INTO public.points_transactions(cliente_id, tipo, pontos, descricao)
    VALUES (
      v_actor.cliente_id, 'estorno', v_points_to_restore,
      'Estorno de pontos do pedido cancelado #' || coalesce(v_order.codigo_orcamento, v_order.id::text)
    );
  END IF;

  IF v_wallet_to_restore > 0 THEN
    v_new_wallet := round(coalesce(v_client.saldo_carteira, 0) + v_wallet_to_restore, 2);
    UPDATE public.clientes SET saldo_carteira = v_new_wallet WHERE id = v_actor.cliente_id;
    INSERT INTO public.carteira_lancamentos(cliente_id, valor, tipo, descricao)
    VALUES (
      v_actor.cliente_id, v_wallet_to_restore, 'credito',
      'Estorno do pedido cancelado #' || coalesce(v_order.codigo_orcamento, v_order.id::text)
    );
    INSERT INTO public.extrato_financeiro(
      cliente_id, tipo, valor, descricao, referencia_id, modulo_referencia, saldo_resultante
    ) VALUES (
      v_actor.cliente_id, 'entrada', v_wallet_to_restore,
      'Estorno do pedido cancelado #' || coalesce(v_order.codigo_orcamento, v_order.id::text),
      p_orcamento_id, 'gsa_store', v_new_wallet
    );
  END IF;

  IF v_order.forma_pagamento_loja = 'credito_loja' THEN
    v_limit_before := coalesce(v_client.limite_credito_disponivel, 0);
    v_limit_after := least(
      coalesce(v_client.limite_credito_total, 0),
      round(v_limit_before + coalesce(v_order.total, 0), 2)
    );
    UPDATE public.clientes SET limite_credito_disponivel = v_limit_after WHERE id = v_actor.cliente_id;
    INSERT INTO public.loja_credito_movimentacoes(
      cliente_id, tipo, valor,
      limite_total_anterior, limite_total_novo,
      limite_disponivel_anterior, limite_disponivel_novo, descricao
    ) VALUES (
      v_actor.cliente_id, 'estorno_compra', coalesce(v_order.total, 0),
      coalesce(v_client.limite_credito_total, 0), coalesce(v_client.limite_credito_total, 0),
      v_limit_before, v_limit_after,
      'Estorno do pedido cancelado #' || coalesce(v_order.codigo_orcamento, v_order.id::text)
    );
  END IF;

  SELECT coalesce(sum(p.valor), 0)
  INTO v_paid_external
  FROM public.pagamentos p
  JOIN public.faturas f ON f.id = p.fatura_id
  WHERE f.orcamento_id = p_orcamento_id
    AND p.metodo NOT IN ('carteira', 'pontos', 'voucher', 'indicacao');

  SELECT id INTO v_first_purchase FROM public.ordens_compra
  WHERE orcamento_id = p_orcamento_id ORDER BY data_criacao, id LIMIT 1;
  SELECT id INTO v_first_subscription FROM public.ordens_assinatura
  WHERE orcamento_id = p_orcamento_id ORDER BY data_criacao, id LIMIT 1;

  IF v_paid_external > 0 THEN
    v_refund_code := public.gsa_generate_code('REEMB');
    INSERT INTO public.loja_reembolsos(
      codigo_reembolso, ordem_compra_id, ordem_assinatura_id,
      cliente_id, valor_reembolso, motivo_cancelamento,
      prazo_pagamento, status
    ) VALUES (
      v_refund_code, v_first_purchase, v_first_subscription,
      v_actor.cliente_id, round(v_paid_external, 2), v_reason,
      now() + interval '3 days', 'pendente'
    ) RETURNING id INTO v_refund_id;
  END IF;

  UPDATE public.faturas
  SET status = 'cancelado', motivo_cancelamento = v_reason, data_cancelamento = now()
  WHERE orcamento_id = p_orcamento_id
    AND status <> 'cancelado';

  UPDATE public.ordens_compra
  SET status = 'cancelado', motivo_cancelamento = v_reason
  WHERE orcamento_id = p_orcamento_id;
  UPDATE public.ordens_assinatura
  SET status = 'cancelado', motivo_cancelamento = v_reason, data_cancelamento = now()
  WHERE orcamento_id = p_orcamento_id;
  UPDATE public.ordens_servico
  SET status = 'cancelado', motivo_cancelamento = v_reason, data_fim = now()
  WHERE orcamento_id = p_orcamento_id;
  UPDATE public.orcamentos
  SET status = 'cancelado', motivo_cancelamento = v_reason
  WHERE id = p_orcamento_id;

  IF v_order.cupom_desconto_id IS NOT NULL THEN
    UPDATE public.cupons_loja
    SET total_usos = greatest(total_usos - 1, 0),
        status = CASE
          WHEN status = 'usado'
           AND (data_validade IS NULL OR data_validade >= current_date)
           AND greatest(total_usos - 1, 0) < limite_usos
          THEN 'ativo' ELSE status END,
        updated_at = now()
    WHERE id = v_order.cupom_desconto_id;
  END IF;
  IF v_order.cupom_entrega_id IS NOT NULL
     AND v_order.cupom_entrega_id IS DISTINCT FROM v_order.cupom_desconto_id THEN
    UPDATE public.cupons_loja
    SET total_usos = greatest(total_usos - 1, 0),
        status = CASE
          WHEN status = 'usado'
           AND (data_validade IS NULL OR data_validade >= current_date)
           AND greatest(total_usos - 1, 0) < limite_usos
          THEN 'ativo' ELSE status END,
        updated_at = now()
    WHERE id = v_order.cupom_entrega_id;
  END IF;

  DELETE FROM public.promocoes_quantidade_uso WHERE orcamento_id = p_orcamento_id;

  INSERT INTO public.orcamento_timeline(
    orcamento_id, cliente_id, ator_id, ator_tipo, tipo, acao,
    status, titulo, descricao, metadata
  ) VALUES (
    p_orcamento_id, v_actor.cliente_id, v_actor.cliente_id, 'cliente',
    'pedido', 'cancelar', 'cancelado', 'Pedido cancelado',
    'Pedido cancelado pelo cliente. Motivo: ' || v_reason,
    jsonb_build_object('reembolso_id', v_refund_id, 'valor_reembolso', v_paid_external)
  );

  INSERT INTO public.notificacoes(
    cliente_id, titulo, mensagem, modulo, tab, item_id,
    destinatario_tipo, prioridade, acao_origem, contexto
  ) VALUES (
    v_actor.cliente_id, 'Pedido cancelado',
    'O pedido ' || coalesce(v_order.codigo_orcamento, v_order.id::text) || ' foi cancelado.',
    'gsa_store', 'compras', p_orcamento_id::text,
    'cliente', 'normal', 'cancelamento_pedido',
    jsonb_build_object('orcamento_id', p_orcamento_id, 'reembolso_id', v_refund_id)
  );

  INSERT INTO public.notificacoes(
    titulo, mensagem, modulo, tab, item_id,
    destinatario_tipo, prioridade, acao_origem, contexto
  ) VALUES (
    'Pedido cancelado pelo cliente',
    v_actor.cliente_nome || ' cancelou o pedido ' || coalesce(v_order.codigo_orcamento, v_order.id::text) || '.',
    'vendas', 'cancelados', p_orcamento_id::text,
    'admin', CASE WHEN v_paid_external > 0 THEN 'alta' ELSE 'normal' END,
    'cancelamento_pedido',
    jsonb_build_object('orcamento_id', p_orcamento_id, 'reembolso_id', v_refund_id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'already_cancelled', false,
    'orcamento_id', p_orcamento_id,
    'reembolso_id', v_refund_id,
    'valor_reembolso', round(v_paid_external, 2),
    'pontos_estornados', v_points_to_restore,
    'carteira_estornada', v_wallet_to_restore,
    'credito_restaurado', CASE WHEN v_order.forma_pagamento_loja = 'credito_loja'
      THEN round(v_limit_after - v_limit_before, 2) ELSE 0 END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_client_generate_store_invoice(uuid, text, uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.gsa_client_cancel_store_order(uuid, text, uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.gsa_client_generate_store_invoice(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_client_cancel_store_order(uuid, text, uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.gerar_fatura_pedido_store(uuid, uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancelar_pedido_loja(uuid, uuid, text) FROM public, anon, authenticated;

COMMENT ON FUNCTION public.gsa_client_generate_store_invoice(uuid, text, uuid) IS
  'Idempotently creates the complete invoice for a store order owned by the authenticated GSA client session.';
COMMENT ON FUNCTION public.gsa_client_cancel_store_order(uuid, text, uuid, text) IS
  'Atomically cancels an owned store order and reverses inventory, benefits, balances, coupons and credit when allowed.';
