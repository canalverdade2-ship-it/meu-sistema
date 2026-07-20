CREATE OR REPLACE FUNCTION public.checkout_pedido(payload json)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_cliente_id UUID;
  v_carrinho JSON;
  v_forma_pagamento TEXT;
  v_pontos_usados INT;
  v_saldo_carteira_usado NUMERIC;
  v_cupom_desconto_id UUID;
  v_cupom_entrega_id UUID;
  v_endereco_entrega JSON;

  v_subtotal_produtos NUMERIC := 0;
  v_subtotal_assinaturas NUMERIC := 0;
  v_total_pedido_final NUMERIC := 0;
  v_desconto_total NUMERIC := 0;
  v_taxa_entrega NUMERIC := 0;
  v_acrescimo NUMERIC := 0;

  item JSON;
  v_produto_id UUID;
  v_produto RECORD;
  v_assinatura RECORD;
  v_cupom RECORD;
  v_cliente RECORD;

  v_orcamento_id UUID;
  v_codigo_orcamento TEXT;
  i INT;
  v_parcelas INT;
BEGIN
  v_cliente_id := (payload->>'cliente_id')::UUID;
  v_carrinho := payload->'carrinho';
  v_forma_pagamento := payload->>'forma_pagamento';
  v_pontos_usados := COALESCE((payload->>'pontos_usados')::INT, 0);
  v_saldo_carteira_usado := COALESCE((payload->>'saldo_carteira_usado')::NUMERIC, 0);
  v_cupom_desconto_id := NULLIF(payload->>'cupom_desconto_id', '')::UUID;
  v_cupom_entrega_id := NULLIF(payload->>'cupom_entrega_id', '')::UUID;
  v_endereco_entrega := payload->'endereco_entrega';
  v_parcelas := COALESCE((payload->>'parcelas')::INT, 1);
  v_taxa_entrega := COALESCE((payload->>'taxa_entrega')::NUMERIC, 0);
  v_acrescimo := COALESCE((payload->>'acrescimo')::NUMERIC, 0);
  v_desconto_total := GREATEST(COALESCE((payload->>'desconto_total')::NUMERIC, 0), 0);

  SELECT * INTO v_cliente FROM clientes WHERE id = v_cliente_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cliente não encontrado.'; END IF;

  FOR item IN SELECT * FROM json_array_elements(v_carrinho)
  LOOP
    IF item->>'tipo' = 'produto' THEN
      v_produto_id := (item->>'item_id')::UUID;

      SELECT * INTO v_produto FROM produtos WHERE id = v_produto_id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Produto não encontrado: %', v_produto_id; END IF;

      IF v_produto.controle_estoque AND v_produto.estoque_disponivel < (item->>'quantidade')::INT THEN
        RAISE EXCEPTION 'Estoque insuficiente para o produto: %', v_produto.nome;
      END IF;

      IF COALESCE((item->>'isBrinde')::BOOLEAN, false) IS NOT TRUE THEN
        v_subtotal_produtos := v_subtotal_produtos + (v_produto.valor * (item->>'quantidade')::INT);
      END IF;

      IF v_produto.controle_estoque THEN
        UPDATE produtos SET estoque_disponivel = estoque_disponivel - (item->>'quantidade')::INT WHERE id = v_produto_id;
      END IF;

    ELSIF item->>'tipo' = 'assinatura' THEN
      SELECT * INTO v_assinatura FROM servicos_assinaturas WHERE id = (item->>'item_id')::UUID;
      IF NOT FOUND THEN RAISE EXCEPTION 'Assinatura não encontrada.'; END IF;

      v_subtotal_assinaturas := v_subtotal_assinaturas + (v_assinatura.valor * (item->>'quantidade')::INT);
    END IF;
  END LOOP;

  IF v_cupom_desconto_id IS NOT NULL THEN
    SELECT * INTO v_cupom FROM cupons_loja WHERE id = v_cupom_desconto_id FOR UPDATE;
    IF NOT FOUND OR v_cupom.status != 'ativo' OR v_cupom.total_usos >= v_cupom.limite_usos THEN
      RAISE EXCEPTION 'Cupom de desconto inválido ou esgotado.';
    END IF;
    IF v_cupom.data_validade IS NOT NULL AND v_cupom.data_validade < CURRENT_DATE THEN
      RAISE EXCEPTION 'Cupom de desconto expirado.';
    END IF;
    IF v_cupom.cliente_id IS NOT NULL AND v_cupom.cliente_id <> v_cliente_id THEN
      RAISE EXCEPTION 'Cupom de desconto exclusivo para outro cliente.';
    END IF;
  END IF;

  IF v_cupom_entrega_id IS NOT NULL THEN
    SELECT * INTO v_cupom FROM cupons_loja WHERE id = v_cupom_entrega_id FOR UPDATE;
    IF NOT FOUND OR v_cupom.status != 'ativo' OR v_cupom.total_usos >= v_cupom.limite_usos THEN
      RAISE EXCEPTION 'Cupom de entrega inválido ou esgotado.';
    END IF;
    IF v_cupom.data_validade IS NOT NULL AND v_cupom.data_validade < CURRENT_DATE THEN
      RAISE EXCEPTION 'Cupom de entrega expirado.';
    END IF;
    IF v_cupom.cliente_id IS NOT NULL AND v_cupom.cliente_id <> v_cliente_id THEN
      RAISE EXCEPTION 'Cupom de entrega exclusivo para outro cliente.';
    END IF;
  END IF;

  v_desconto_total := LEAST(v_desconto_total, v_subtotal_produtos + v_subtotal_assinaturas + v_taxa_entrega + v_acrescimo);
  v_total_pedido_final := GREATEST((v_subtotal_produtos + v_subtotal_assinaturas + v_taxa_entrega + v_acrescimo) - v_desconto_total, 0);

  IF v_forma_pagamento = 'credito_loja' AND v_cliente.limite_credito_disponivel < v_total_pedido_final THEN
    RAISE EXCEPTION 'Limite insuficiente.';
  END IF;

  IF v_pontos_usados > 0 AND v_cliente.saldo_pontos < v_pontos_usados THEN
    RAISE EXCEPTION 'Pontos insuficientes.';
  END IF;

  IF v_saldo_carteira_usado > 0 AND v_cliente.saldo_carteira < v_saldo_carteira_usado THEN
    RAISE EXCEPTION 'Carteira insuficiente.';
  END IF;

  INSERT INTO orcamentos (
    cliente_id, categoria, total, desconto, taxa_entrega, acrescimo, status, origem_gsa_store,
    cupom_desconto_id, cupom_entrega_id, endereco_entrega, titulo_solicitacao, quantidade
  ) VALUES (
    v_cliente_id, 'loja', v_total_pedido_final, v_desconto_total, v_taxa_entrega, v_acrescimo, 'aprovado', true,
    v_cupom_desconto_id, v_cupom_entrega_id, v_endereco_entrega, 'Pedido GSA Store via RPC Seguro',
    (payload->>'total_itens')::INT
  ) RETURNING id, codigo_orcamento INTO v_orcamento_id, v_codigo_orcamento;

  IF v_cupom_desconto_id IS NOT NULL THEN
    UPDATE cupons_loja SET total_usos = total_usos + 1 WHERE id = v_cupom_desconto_id;
  END IF;

  IF v_cupom_entrega_id IS NOT NULL AND v_cupom_entrega_id IS DISTINCT FROM v_cupom_desconto_id THEN
    UPDATE cupons_loja SET total_usos = total_usos + 1 WHERE id = v_cupom_entrega_id;
  END IF;

  IF v_forma_pagamento = 'credito_loja' THEN
    UPDATE clientes SET limite_credito_disponivel = limite_credito_disponivel - v_total_pedido_final WHERE id = v_cliente_id;

    INSERT INTO loja_credito_movimentacoes (cliente_id, tipo, valor, descricao)
    VALUES (v_cliente_id, 'compra', v_total_pedido_final, 'Compra GSA Store #' || v_codigo_orcamento);

    FOR i IN 1..v_parcelas LOOP
      INSERT INTO faturas (codigo_fatura, cliente_id, valor_total, valor_final_pendente, status, gerada_automaticamente, is_amortizacao_credito)
      VALUES ('FAT-CRE-' || v_codigo_orcamento || '-' || i, v_cliente_id, v_total_pedido_final / v_parcelas, v_total_pedido_final / v_parcelas, 'pendente', true, true);
    END LOOP;
  END IF;

  IF v_pontos_usados > 0 THEN
    UPDATE clientes SET saldo_pontos = saldo_pontos - v_pontos_usados WHERE id = v_cliente_id;
  END IF;

  IF v_saldo_carteira_usado > 0 THEN
    UPDATE clientes SET saldo_carteira = saldo_carteira - v_saldo_carteira_usado WHERE id = v_cliente_id;
  END IF;

  DELETE FROM loja_carrinhos WHERE cliente_id = v_cliente_id;

  RETURN json_build_object('status', 'success', 'orcamento_id', v_orcamento_id, 'codigo_orcamento', v_codigo_orcamento);
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('status', 'error', 'message', SQLERRM);
END;
$function$;
