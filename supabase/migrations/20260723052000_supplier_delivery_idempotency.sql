-- Validacao e idempotencia das entregas e notas fiscais.

BEGIN;

CREATE OR REPLACE FUNCTION public.gsa_supplier_submit_delivery(
  p_request_id uuid,
  p_order_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid := public.gsa_assert_current_supplier();
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_order public.pedidos_compra_fornecedor%rowtype;
  v_delivery_id uuid;
  v_item jsonb;
  v_order_item public.pedido_compra_fornecedor_itens%rowtype;
  v_quantity integer;
  v_pending integer;
  v_xml text := nullif(trim(v_payload->>'arquivo_xml'), '');
  v_pdf text := nullif(trim(v_payload->>'arquivo_pdf'), '');
  v_key text := nullif(regexp_replace(coalesce(v_payload->>'chave_nfe', ''), '\D', '', 'g'), '');
  v_note_number text := trim(coalesce(v_payload->>'numero_nota', ''));
  v_issue_date date;
  v_total numeric;
BEGIN
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'Identificador da operacao obrigatorio.'; END IF;
  SELECT id INTO v_delivery_id FROM public.fornecedor_entregas WHERE request_id = p_request_id;
  IF v_delivery_id IS NOT NULL THEN RETURN jsonb_build_object('success', true, 'already_processed', true, 'delivery_id', v_delivery_id); END IF;
  IF pg_column_size(v_payload) > 65536 THEN RAISE EXCEPTION 'Dados da entrega excedem o limite permitido.'; END IF;

  SELECT * INTO v_order FROM public.pedidos_compra_fornecedor
  WHERE id = p_order_id AND fornecedor_id = v_id FOR UPDATE;
  IF NOT FOUND OR v_order.status IN ('rascunho', 'cancelado', 'concluido') THEN RAISE EXCEPTION 'Pedido indisponivel para entrega.'; END IF;
  IF jsonb_typeof(v_payload->'items') <> 'array' OR jsonb_array_length(v_payload->'items') = 0 THEN RAISE EXCEPTION 'Informe os itens entregues.'; END IF;
  IF v_xml IS NULL AND v_pdf IS NULL THEN RAISE EXCEPTION 'Envie o XML ou PDF da nota fiscal.'; END IF;
  IF v_note_number = '' OR length(v_note_number) > 80 THEN RAISE EXCEPTION 'Informe um numero de nota fiscal valido.'; END IF;
  IF v_key IS NOT NULL AND length(v_key) <> 44 THEN RAISE EXCEPTION 'A chave da NF-e deve possuir 44 digitos.'; END IF;

  BEGIN
    v_issue_date := nullif(v_payload->>'data_emissao', '')::date;
    v_total := nullif(v_payload->>'valor_total_nota', '')::numeric;
  EXCEPTION WHEN invalid_text_representation OR datetime_field_overflow OR numeric_value_out_of_range THEN
    RAISE EXCEPTION 'Data de emissao ou valor total da nota invalido.';
  END;
  IF v_issue_date IS NULL THEN RAISE EXCEPTION 'Informe a data de emissao.'; END IF;
  IF v_total IS NULL OR v_total < 0 THEN RAISE EXCEPTION 'Informe um valor total valido.'; END IF;

  IF v_xml IS NOT NULL AND v_xml <> ('storage://documentos_fornecedor/' || v_id::text || '/notas-fiscais/' || p_order_id::text || '/' || p_request_id::text || '.xml') THEN
    RAISE EXCEPTION 'Referencia XML invalida para esta operacao.';
  END IF;
  IF v_pdf IS NOT NULL AND v_pdf <> ('storage://documentos_fornecedor/' || v_id::text || '/notas-fiscais/' || p_order_id::text || '/' || p_request_id::text || '.pdf') THEN
    RAISE EXCEPTION 'Referencia PDF invalida para esta operacao.';
  END IF;

  INSERT INTO public.fornecedor_entregas(
    pedido_id, fornecedor_id, numero_nota, serie_nota, chave_nfe, data_emissao,
    valor_total_nota, vencimento, arquivo_xml, arquivo_pdf, observacoes, request_id
  ) VALUES (
    p_order_id, v_id, v_note_number, nullif(trim(v_payload->>'serie_nota'), ''),
    v_key, v_issue_date, v_total,
    coalesce(nullif(v_payload->>'vencimento', '')::date, v_order.vencimento_previsto, current_date + 7),
    v_xml, v_pdf, nullif(trim(v_payload->>'observacoes'), ''), p_request_id
  ) RETURNING id INTO v_delivery_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_payload->'items') LOOP
    SELECT * INTO v_order_item FROM public.pedido_compra_fornecedor_itens
    WHERE id = (v_item->>'pedido_item_id')::uuid AND pedido_id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Item nao pertence ao pedido.'; END IF;
    v_quantity := coalesce((v_item->>'quantidade_entregue')::integer, 0);
    SELECT v_order_item.quantidade_pedida - v_order_item.quantidade_aprovada - coalesce(sum(ei.quantidade_entregue), 0)
      INTO v_pending
    FROM public.fornecedor_entrega_itens ei
    JOIN public.fornecedor_entregas e ON e.id = ei.entrega_id
    WHERE ei.pedido_item_id = v_order_item.id AND e.status = 'em_analise';
    IF v_quantity <= 0 OR v_quantity > v_pending THEN RAISE EXCEPTION 'Quantidade entregue excede o saldo pendente de %.', v_order_item.produto_nome_snapshot; END IF;

    INSERT INTO public.fornecedor_entrega_itens(
      entrega_id, pedido_item_id, produto_id, quantidade_entregue,
      custo_unitario_nota, lote, validade
    ) VALUES (
      v_delivery_id, v_order_item.id, v_order_item.produto_id, v_quantity,
      coalesce(nullif(v_item->>'custo_unitario_nota', '')::numeric, v_order_item.custo_unitario),
      nullif(trim(v_item->>'lote'), ''), nullif(v_item->>'validade', '')::date
    );
  END LOOP;

  UPDATE public.fornecedor_entregas
  SET status = 'cancelado'
  WHERE pedido_id = p_order_id
    AND fornecedor_id = v_id
    AND status = 'ajuste_solicitado'
    AND id <> v_delivery_id;

  UPDATE public.pedidos_compra_fornecedor SET status = 'em_analise' WHERE id = p_order_id;

  INSERT INTO public.fornecedor_auditoria(fornecedor_id, ator_tipo, ator_id, acao, entidade, entidade_id, detalhes)
  VALUES (v_id, 'fornecedor', v_id, 'ENVIAR_ENTREGA_NF', 'fornecedor_entregas', v_delivery_id,
    jsonb_build_object('pedido_id', p_order_id, 'request_id', p_request_id));

  INSERT INTO public.notificacoes(titulo, mensagem, modulo, tab, item_id, tipo, destinatario_tipo, prioridade, acao_origem, contexto)
  VALUES (
    'Nova entrega de fornecedor aguardando analise',
    'A nota fiscal ' || v_note_number || ' foi enviada para conferencia.',
    'fornecedores', 'entregas', v_delivery_id::text, 'sistema', 'admin', 'alta',
    'entrega_fornecedor_enviada', jsonb_build_object('fornecedor_id', v_id, 'pedido_id', p_order_id, 'entrega_id', v_delivery_id)
  );

  RETURN jsonb_build_object('success', true, 'already_processed', false, 'delivery_id', v_delivery_id);
END;
$$;

COMMIT;
