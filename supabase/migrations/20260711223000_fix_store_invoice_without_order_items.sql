CREATE OR REPLACE FUNCTION public.gerar_fatura_pedido_store(p_orcamento_id uuid, p_cliente_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orc orcamentos%rowtype;
  v_fatura_id uuid;
  v_codigo text;
  v_oc_id uuid;
  v_oa_id uuid;
  v_tipo text;
  v_itens jsonb;
  v_itens_prod jsonb := '[]'::jsonb;
  v_itens_ass jsonb := '[]'::jsonb;
  v_pts numeric := 0;
  v_voucher numeric := 0;
  v_base numeric;
  v_quantidade integer;
  v_valor_unitario numeric;
BEGIN
  SELECT * INTO v_orc
  FROM orcamentos
  WHERE id = p_orcamento_id
    AND cliente_id = p_cliente_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  SELECT id INTO v_oc_id FROM ordens_compra WHERE orcamento_id = p_orcamento_id ORDER BY id LIMIT 1;
  SELECT id INTO v_oa_id FROM ordens_assinatura WHERE orcamento_id = p_orcamento_id ORDER BY id LIMIT 1;

  SELECT id INTO v_fatura_id
  FROM faturas
  WHERE cliente_id = p_cliente_id
    AND status IN ('pendente', 'pendente_pagamento', 'vencida', 'aguardando_link', 'pago')
    AND (
      (v_oc_id IS NOT NULL AND ordem_compra_id = v_oc_id)
      OR (v_oa_id IS NOT NULL AND ordem_assinatura_id = v_oa_id)
      OR codigo_fatura = 'FAT-LOJA-' || coalesce(v_orc.codigo_orcamento, p_orcamento_id::text)
    )
  ORDER BY CASE WHEN status IN ('pendente', 'pendente_pagamento', 'vencida', 'aguardando_link') THEN 0 ELSE 1 END, created_at
  LIMIT 1;

  IF v_fatura_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'fatura_id', v_fatura_id, 'already_exists', true);
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', oc.id,
    'codigo', coalesce(p.codigo_produto, 'PRODUTO'),
    'descricao', coalesce(p.nome, 'Produto'),
    'valor_unitario', coalesce(p.valor, 0),
    'quantidade', coalesce(oc.quantidade, 1),
    'subtotal', round(coalesce(p.valor, 0) * coalesce(oc.quantidade, 1), 2),
    'tipo', 'produto'
  )), '[]'::jsonb)
  INTO v_itens_prod
  FROM ordens_compra oc
  LEFT JOIN produtos p ON p.id = oc.produto_id
  WHERE oc.orcamento_id = p_orcamento_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', oa.id,
    'codigo', coalesce(a.codigo_assinatura, 'ASSINATURA'),
    'descricao', coalesce(a.nome, 'Assinatura'),
    'valor_unitario', coalesce(a.valor, 0),
    'quantidade', coalesce(oa.quantidade, 1),
    'subtotal', round(coalesce(a.valor, 0) * coalesce(oa.quantidade, 1), 2),
    'tipo', 'assinatura'
  )), '[]'::jsonb)
  INTO v_itens_ass
  FROM ordens_assinatura oa
  LEFT JOIN assinaturas a ON a.id = oa.assinatura_id
  WHERE oa.orcamento_id = p_orcamento_id;

  v_itens := v_itens_prod || v_itens_ass;

  IF jsonb_array_length(v_itens) = 0 THEN
    v_quantidade := greatest(coalesce(v_orc.quantidade, 1), 1);
    v_valor_unitario := round(coalesce(v_orc.total, 0) / v_quantidade, 2);
    v_itens := jsonb_build_array(jsonb_build_object(
      'id', p_orcamento_id,
      'codigo', coalesce(v_orc.codigo_orcamento, 'PEDIDO'),
      'descricao', coalesce(v_orc.titulo_solicitacao, 'Pedido GSA Store'),
      'valor_unitario', v_valor_unitario,
      'quantidade', v_quantidade,
      'subtotal', round(coalesce(v_orc.total, 0), 2),
      'tipo', coalesce(v_orc.categoria, 'loja')
    ));
  END IF;

  v_tipo := CASE
    WHEN jsonb_array_length(v_itens_prod) > 0 THEN 'produto'
    WHEN jsonb_array_length(v_itens_ass) > 0 THEN 'assinatura'
    ELSE 'produto'
  END;
  v_codigo := 'FAT-LOJA-' || coalesce(v_orc.codigo_orcamento, p_orcamento_id::text);

  SELECT coalesce(abs(pt.pontos) * 0.01, 0)
  INTO v_pts
  FROM points_transactions pt
  WHERE pt.cliente_id = p_cliente_id
    AND v_orc.codigo_orcamento IS NOT NULL
    AND pt.descricao ILIKE '%' || v_orc.codigo_orcamento || '%'
  ORDER BY pt.created_at DESC
  LIMIT 1;

  v_pts := coalesce(v_pts, 0);
  v_voucher := greatest(0, coalesce(v_orc.desconto, 0) - v_pts);
  v_base := round(coalesce(v_orc.total, 0) + coalesce(v_orc.desconto, 0) - coalesce(v_orc.taxa_entrega, 0), 2);

  INSERT INTO faturas(
    cliente_id, codigo_fatura, valor_total, valor_final_pendente, status, tipo,
    itens_faturados, desconto_voucher_aplicado, desconto_pontos_aplicado, valor_base_original,
    data_vencimento, ordem_compra_id, ordem_assinatura_id
  )
  VALUES (
    p_cliente_id, v_codigo, round(coalesce(v_orc.total, 0), 2), round(coalesce(v_orc.total, 0), 2), 'pendente', v_tipo,
    v_itens, v_voucher, v_pts, v_base, current_date + 7,
    CASE WHEN v_tipo = 'produto' THEN v_oc_id ELSE NULL END,
    CASE WHEN v_tipo = 'assinatura' THEN v_oa_id ELSE NULL END
  )
  RETURNING id INTO v_fatura_id;

  RETURN jsonb_build_object('success', true, 'fatura_id', v_fatura_id, 'already_exists', false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.gerar_fatura_pedido_store(uuid, uuid) TO anon, authenticated;
