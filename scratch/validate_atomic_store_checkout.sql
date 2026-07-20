DO $$
DECLARE
  v_client_id uuid := gen_random_uuid();
  v_product_id uuid := gen_random_uuid();
  v_service_id uuid := gen_random_uuid();
  v_subscription_id uuid := gen_random_uuid();
  v_promo_id uuid := gen_random_uuid();
  v_discount_coupon_id uuid := gen_random_uuid();
  v_shipping_coupon_id uuid := gen_random_uuid();
  v_request_id uuid := gen_random_uuid();
  v_credit_request_id uuid := gen_random_uuid();
  v_session jsonb;
  v_result jsonb;
  v_repeat jsonb;
  v_credit_result jsonb;
  v_count integer;
  v_value numeric;
  v_rejected boolean := false;
BEGIN
  INSERT INTO public.clientes(
    id, nome, tipo_pessoa, status, saldo_pontos, saldo_carteira,
    limite_credito_total, limite_credito_disponivel,
    opcao_pagamento_parcelado, max_parcelas
  ) VALUES (
    v_client_id, 'Cliente Teste Checkout', 'pf', 'ativo', 1000, 50,
    200, 200, true, 6
  );

  INSERT INTO public.produtos(
    id, codigo_produto, nome, valor, status, tipo_cliente,
    visivel_na_loja, ocultar_valor, controle_estoque, estoque_disponivel
  ) VALUES (
    v_product_id, 'PROD-TEST-' || left(v_product_id::text, 8),
    'Produto Teste', 10, 'ativo', 'pf', true, false, true, 20
  );

  INSERT INTO public.servicos(
    id, codigo_servico, nome, valor, status, tipo_cliente,
    visivel_na_loja, ocultar_valor
  ) VALUES (
    v_service_id, 'SERV-TEST-' || left(v_service_id::text, 8),
    'Serviço Teste', 20, 'ativo', 'pf', true, false
  );

  INSERT INTO public.assinaturas(
    id, codigo_assinatura, nome, valor, status, tipo_cliente,
    visivel_na_loja, ocultar_valor
  ) VALUES (
    v_subscription_id, 'ASS-TEST-' || left(v_subscription_id::text, 8),
    'Assinatura Teste', 30, 'ativo', 'pf', true, false
  );

  INSERT INTO public.promocoes_quantidade(
    id, nome, tipo_promocao, escopo_gatilho, produto_gatilho_id,
    quantidade_minima, desconto_tipo, desconto_valor,
    uso_maximo_por_cliente, status
  ) VALUES (
    v_promo_id, 'Teste 50% na terceira unidade', 'desconto_proxima',
    'produto', v_product_id, 3, 'porcentagem', 50, 2, 'ativa'
  );
  INSERT INTO public.promocoes_quantidade_ativadas(cliente_id, promocao_quantidade_id)
  VALUES (v_client_id, v_promo_id);

  INSERT INTO public.cupons_loja(
    id, codigo_cupom, nome_cupom, categoria_cupom,
    tipo_desconto, valor_desconto, limite_usos, total_usos, status
  ) VALUES (
    v_discount_coupon_id, 'DESC-' || left(v_discount_coupon_id::text, 8),
    'Desconto teste', 'desconto', 'valor', 10, 10, 0, 'ativo'
  );
  INSERT INTO public.cupons_loja(
    id, codigo_cupom, nome_cupom, categoria_cupom,
    tipo_entrega, limite_usos, total_usos, status
  ) VALUES (
    v_shipping_coupon_id, 'FRETE-' || left(v_shipping_coupon_id::text, 8),
    'Frete teste', 'entrega', 'frete_gratis', 10, 0, 'ativo'
  );
  INSERT INTO public.cupons_ativados(cliente_id, cupom_id)
  VALUES (v_client_id, v_discount_coupon_id), (v_client_id, v_shipping_coupon_id);

  v_session := public.gsa_create_session_internal(
    'cliente', v_client_id, 'Cliente Teste Checkout', jsonb_build_object('teste', true)
  );

  v_result := public.gsa_client_checkout_store(
    (v_session ->> 'sessao_id')::uuid,
    v_session ->> 'session_token',
    jsonb_build_object(
      'request_id', v_request_id,
      'carrinho', jsonb_build_array(
        jsonb_build_object('tipo', 'produto', 'item_id', v_product_id, 'quantidade', 3),
        jsonb_build_object('tipo', 'servico', 'item_id', v_service_id, 'quantidade', 1),
        jsonb_build_object('tipo', 'assinatura', 'item_id', v_subscription_id, 'quantidade', 1, 'prazo_meses', 12)
      ),
      'forma_pagamento', 'outros',
      'pontos_usados', 100,
      'saldo_carteira_usado', 5,
      'cupom_desconto_id', v_discount_coupon_id,
      'cupom_entrega_id', v_shipping_coupon_id,
      'parcelas', 1,
      'endereco_entrega', jsonb_build_object(
        'cep', '12948110', 'logradouro', 'Rua Teste', 'numero', '100',
        'bairro', 'Centro', 'cidade', 'Atibaia', 'uf', 'SP'
      )
    )
  );

  IF coalesce((v_result ->> 'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Checkout de teste não retornou sucesso: %', v_result;
  END IF;
  IF (v_result ->> 'total')::numeric <> 59 THEN
    RAISE EXCEPTION 'Total autoritativo incorreto: %', v_result;
  END IF;
  IF (v_result ->> 'desconto_promocional')::numeric <> 5
     OR (v_result ->> 'desconto_pontos')::numeric <> 1
     OR (v_result ->> 'desconto_cupom')::numeric <> 10
     OR (v_result ->> 'abatimento_carteira')::numeric <> 5
     OR (v_result ->> 'taxa_entrega')::numeric <> 0 THEN
    RAISE EXCEPTION 'Composição financeira incorreta: %', v_result;
  END IF;

  SELECT count(*) INTO v_count FROM public.loja_pedido_itens
  WHERE orcamento_id = (v_result ->> 'orcamento_id')::uuid;
  IF v_count <> 3 THEN RAISE EXCEPTION 'Itens normalizados incorretos: %', v_count; END IF;

  SELECT count(*) INTO v_count
  FROM (
    SELECT id FROM public.ordens_compra WHERE orcamento_id = (v_result ->> 'orcamento_id')::uuid
    UNION ALL SELECT id FROM public.ordens_servico WHERE orcamento_id = (v_result ->> 'orcamento_id')::uuid
    UNION ALL SELECT id FROM public.ordens_assinatura WHERE orcamento_id = (v_result ->> 'orcamento_id')::uuid
  ) AS orders;
  IF v_count <> 3 THEN RAISE EXCEPTION 'Ordens vinculadas incorretas: %', v_count; END IF;

  SELECT estoque_disponivel INTO v_count FROM public.produtos WHERE id = v_product_id;
  IF v_count <> 17 THEN RAISE EXCEPTION 'Baixa de estoque incorreta: %', v_count; END IF;

  SELECT saldo_carteira INTO v_value FROM public.clientes WHERE id = v_client_id;
  IF v_value <> 45 THEN RAISE EXCEPTION 'Saldo da carteira incorreto: %', v_value; END IF;
  SELECT saldo_pontos INTO v_count FROM public.clientes WHERE id = v_client_id;
  IF v_count <> 900 THEN RAISE EXCEPTION 'Saldo de pontos incorreto: %', v_count; END IF;

  v_repeat := public.gsa_client_checkout_store(
    (v_session ->> 'sessao_id')::uuid,
    v_session ->> 'session_token',
    jsonb_build_object('request_id', v_request_id, 'carrinho', jsonb_build_array(
      jsonb_build_object('tipo', 'produto', 'item_id', v_product_id, 'quantidade', 99)
    ))
  );
  IF coalesce((v_repeat ->> 'already_exists')::boolean, false) IS NOT TRUE
     OR v_repeat ->> 'orcamento_id' <> v_result ->> 'orcamento_id' THEN
    RAISE EXCEPTION 'Idempotência não preservou o pedido original: %', v_repeat;
  END IF;
  SELECT estoque_disponivel INTO v_count FROM public.produtos WHERE id = v_product_id;
  IF v_count <> 17 THEN RAISE EXCEPTION 'Repetição alterou o estoque: %', v_count; END IF;

  BEGIN
    PERFORM public.gsa_client_checkout_store(
      (v_session ->> 'sessao_id')::uuid,
      v_session ->> 'session_token',
      jsonb_build_object(
        'request_id', gen_random_uuid(),
        'carrinho', jsonb_build_array(jsonb_build_object(
          'tipo', 'produto', 'item_id', v_product_id, 'quantidade', 1,
          'valor', 0, 'isBrinde', true
        ))
      )
    );
  EXCEPTION WHEN others THEN
    v_rejected := true;
  END;
  IF v_rejected IS NOT TRUE THEN
    RAISE EXCEPTION 'Payload adulterado foi aceito.';
  END IF;

  v_credit_result := public.gsa_client_checkout_store(
    (v_session ->> 'sessao_id')::uuid,
    v_session ->> 'session_token',
    jsonb_build_object(
      'request_id', v_credit_request_id,
      'carrinho', jsonb_build_array(
        jsonb_build_object('tipo', 'produto', 'item_id', v_product_id, 'quantidade', 1)
      ),
      'forma_pagamento', 'credito_loja',
      'pontos_usados', 0,
      'saldo_carteira_usado', 0,
      'parcelas', 1,
      'endereco_entrega', jsonb_build_object(
        'cep', '12948110', 'logradouro', 'Rua Teste', 'numero', '100',
        'bairro', 'Centro', 'cidade', 'Atibaia', 'uf', 'SP'
      )
    )
  );
  IF (v_credit_result ->> 'total')::numeric <> 48 THEN
    RAISE EXCEPTION 'Total do Crédito GSA incorreto: %', v_credit_result;
  END IF;
  SELECT limite_credito_disponivel INTO v_value FROM public.clientes WHERE id = v_client_id;
  IF v_value <> 152 THEN RAISE EXCEPTION 'Baixa do limite de crédito incorreta: %', v_value; END IF;
  SELECT count(*) INTO v_count FROM public.faturas
  WHERE orcamento_id = (v_credit_result ->> 'orcamento_id')::uuid
    AND valor_total = 48 AND is_amortizacao_credito IS TRUE;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Fatura do crédito não foi criada corretamente.'; END IF;
  SELECT count(*) INTO v_count FROM public.loja_credito_movimentacoes
  WHERE cliente_id = v_client_id AND tipo = 'compra' AND valor = 48;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Movimentação do crédito não foi registrada.'; END IF;
END;
$$;
