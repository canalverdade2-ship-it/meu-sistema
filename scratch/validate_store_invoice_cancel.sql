DO $$
DECLARE
  v_client_id uuid := gen_random_uuid();
  v_other_client_id uuid := gen_random_uuid();
  v_product_id uuid := gen_random_uuid();
  v_session jsonb;
  v_other_session jsonb;
  v_order jsonb;
  v_invoice jsonb;
  v_repeat jsonb;
  v_cancel jsonb;
  v_credit_order jsonb;
  v_paid_order jsonb;
  v_paid_invoice jsonb;
  v_rejected boolean := false;
  v_count integer;
  v_value numeric;
BEGIN
  INSERT INTO public.clientes(
    id, nome, tipo_pessoa, status, saldo_pontos, saldo_carteira,
    limite_credito_total, limite_credito_disponivel,
    opcao_pagamento_parcelado, max_parcelas
  ) VALUES
    (v_client_id, 'Cliente Teste Fatura', 'pf', 'ativo', 1000, 50, 200, 200, true, 6),
    (v_other_client_id, 'Outro Cliente Teste', 'pf', 'ativo', 0, 0, 0, 0, false, 1);

  INSERT INTO public.produtos(
    id, codigo_produto, nome, valor, status, tipo_cliente,
    visivel_na_loja, ocultar_valor, controle_estoque, estoque_disponivel
  ) VALUES (
    v_product_id, 'PROD-FAT-' || left(v_product_id::text, 8),
    'Produto Teste Fatura', 10, 'ativo', 'pf', true, false, true, 20
  );

  v_session := public.gsa_create_session_internal('cliente', v_client_id, 'Cliente Teste Fatura', '{}'::jsonb);
  v_other_session := public.gsa_create_session_internal('cliente', v_other_client_id, 'Outro Cliente Teste', '{}'::jsonb);

  v_order := public.gsa_client_checkout_store(
    (v_session ->> 'sessao_id')::uuid, v_session ->> 'session_token',
    jsonb_build_object(
      'request_id', gen_random_uuid(),
      'carrinho', jsonb_build_array(jsonb_build_object(
        'tipo', 'produto', 'item_id', v_product_id, 'quantidade', 2
      )),
      'forma_pagamento', 'outros', 'pontos_usados', 100,
      'saldo_carteira_usado', 5, 'parcelas', 1,
      'endereco_entrega', jsonb_build_object(
        'cep', '12948110', 'logradouro', 'Rua Teste', 'numero', '100',
        'bairro', 'Centro', 'cidade', 'Atibaia', 'uf', 'SP'
      )
    )
  );

  IF (v_order ->> 'total')::numeric <> 44 THEN
    RAISE EXCEPTION 'Total inesperado no pedido de fatura: %', v_order;
  END IF;

  v_invoice := public.gsa_client_generate_store_invoice(
    (v_session ->> 'sessao_id')::uuid, v_session ->> 'session_token',
    (v_order ->> 'orcamento_id')::uuid
  );
  IF coalesce((v_invoice ->> 'success')::boolean, false) IS NOT TRUE
     OR coalesce((v_invoice ->> 'already_exists')::boolean, false) IS TRUE THEN
    RAISE EXCEPTION 'Primeira geração de fatura inválida: %', v_invoice;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.faturas f, jsonb_array_elements(f.itens_faturados) item
  WHERE f.id = (v_invoice ->> 'fatura_id')::uuid
    AND f.orcamento_id = (v_order ->> 'orcamento_id')::uuid
    AND f.valor_total = 44
    AND item ->> 'descricao' = 'Produto Teste Fatura';
  IF v_count <> 1 THEN RAISE EXCEPTION 'Fatura não preservou os itens e valores do pedido.'; END IF;

  v_repeat := public.gsa_client_generate_store_invoice(
    (v_session ->> 'sessao_id')::uuid, v_session ->> 'session_token',
    (v_order ->> 'orcamento_id')::uuid
  );
  IF coalesce((v_repeat ->> 'already_exists')::boolean, false) IS NOT TRUE
     OR v_repeat ->> 'fatura_id' <> v_invoice ->> 'fatura_id' THEN
    RAISE EXCEPTION 'Geração de fatura não foi idempotente: %', v_repeat;
  END IF;

  BEGIN
    PERFORM public.gsa_client_generate_store_invoice(
      (v_other_session ->> 'sessao_id')::uuid, v_other_session ->> 'session_token',
      (v_order ->> 'orcamento_id')::uuid
    );
  EXCEPTION WHEN others THEN
    v_rejected := true;
  END;
  IF v_rejected IS NOT TRUE THEN RAISE EXCEPTION 'Outro cliente acessou a fatura do pedido.'; END IF;

  v_cancel := public.gsa_client_cancel_store_order(
    (v_session ->> 'sessao_id')::uuid, v_session ->> 'session_token',
    (v_order ->> 'orcamento_id')::uuid, 'Cancelamento transacional de teste'
  );
  IF coalesce((v_cancel ->> 'success')::boolean, false) IS NOT TRUE
     OR (v_cancel ->> 'pontos_estornados')::integer <> 100
     OR (v_cancel ->> 'carteira_estornada')::numeric <> 5 THEN
    RAISE EXCEPTION 'Estorno do pedido incorreto: %', v_cancel;
  END IF;
  SELECT estoque_disponivel INTO v_count FROM public.produtos WHERE id = v_product_id;
  IF v_count <> 20 THEN RAISE EXCEPTION 'Estoque não foi restaurado: %', v_count; END IF;
  SELECT saldo_pontos INTO v_count FROM public.clientes WHERE id = v_client_id;
  IF v_count <> 1000 THEN RAISE EXCEPTION 'Pontos não foram restaurados: %', v_count; END IF;
  SELECT saldo_carteira INTO v_value FROM public.clientes WHERE id = v_client_id;
  IF v_value <> 50 THEN RAISE EXCEPTION 'Carteira não foi restaurada: %', v_value; END IF;

  v_repeat := public.gsa_client_cancel_store_order(
    (v_session ->> 'sessao_id')::uuid, v_session ->> 'session_token',
    (v_order ->> 'orcamento_id')::uuid, 'Cancelamento repetido'
  );
  IF coalesce((v_repeat ->> 'already_cancelled')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Cancelamento repetido não foi idempotente: %', v_repeat;
  END IF;
  SELECT estoque_disponivel INTO v_count FROM public.produtos WHERE id = v_product_id;
  IF v_count <> 20 THEN RAISE EXCEPTION 'Cancelamento repetido duplicou estoque: %', v_count; END IF;

  v_credit_order := public.gsa_client_checkout_store(
    (v_session ->> 'sessao_id')::uuid, v_session ->> 'session_token',
    jsonb_build_object(
      'request_id', gen_random_uuid(),
      'carrinho', jsonb_build_array(jsonb_build_object(
        'tipo', 'produto', 'item_id', v_product_id, 'quantidade', 1
      )),
      'forma_pagamento', 'credito_loja', 'pontos_usados', 0,
      'saldo_carteira_usado', 0, 'parcelas', 1,
      'endereco_entrega', jsonb_build_object(
        'cep', '12948110', 'logradouro', 'Rua Teste', 'numero', '100',
        'bairro', 'Centro', 'cidade', 'Atibaia', 'uf', 'SP'
      )
    )
  );
  PERFORM public.gsa_client_cancel_store_order(
    (v_session ->> 'sessao_id')::uuid, v_session ->> 'session_token',
    (v_credit_order ->> 'orcamento_id')::uuid, 'Cancelamento do Crédito GSA de teste'
  );
  SELECT limite_credito_disponivel INTO v_value FROM public.clientes WHERE id = v_client_id;
  IF v_value <> 200 THEN RAISE EXCEPTION 'Limite do Crédito GSA não foi restaurado: %', v_value; END IF;
  SELECT count(*) INTO v_count FROM public.faturas
  WHERE orcamento_id = (v_credit_order ->> 'orcamento_id')::uuid AND status = 'cancelado';
  IF v_count <> 1 THEN RAISE EXCEPTION 'Fatura do Crédito GSA não foi cancelada.'; END IF;

  v_paid_order := public.gsa_client_checkout_store(
    (v_session ->> 'sessao_id')::uuid, v_session ->> 'session_token',
    jsonb_build_object(
      'request_id', gen_random_uuid(),
      'carrinho', jsonb_build_array(jsonb_build_object(
        'tipo', 'produto', 'item_id', v_product_id, 'quantidade', 1
      )),
      'forma_pagamento', 'outros', 'pontos_usados', 0,
      'saldo_carteira_usado', 0, 'parcelas', 1,
      'endereco_entrega', jsonb_build_object(
        'cep', '12948110', 'logradouro', 'Rua Teste', 'numero', '100',
        'bairro', 'Centro', 'cidade', 'Atibaia', 'uf', 'SP'
      )
    )
  );
  v_paid_invoice := public.gsa_client_generate_store_invoice(
    (v_session ->> 'sessao_id')::uuid, v_session ->> 'session_token',
    (v_paid_order ->> 'orcamento_id')::uuid
  );
  UPDATE public.faturas
  SET status = 'pago', valor_pago = valor_total,
      valor_final_pendente = 0, forma_pagamento_escolhida = 'pix', data_pagamento = now()
  WHERE id = (v_paid_invoice ->> 'fatura_id')::uuid;
  INSERT INTO public.pagamentos(fatura_id, valor, metodo)
  VALUES ((v_paid_invoice ->> 'fatura_id')::uuid, (v_paid_order ->> 'total')::numeric, 'pix');

  v_cancel := public.gsa_client_cancel_store_order(
    (v_session ->> 'sessao_id')::uuid, v_session ->> 'session_token',
    (v_paid_order ->> 'orcamento_id')::uuid, 'Cancelamento pago para testar reembolso'
  );
  IF coalesce(v_cancel ->> 'reembolso_id', '') = ''
     OR (v_cancel ->> 'valor_reembolso')::numeric <> (v_paid_order ->> 'total')::numeric THEN
    RAISE EXCEPTION 'Reembolso do pagamento externo não foi criado corretamente: %', v_cancel;
  END IF;
  SELECT count(*) INTO v_count FROM public.loja_reembolsos
  WHERE id = (v_cancel ->> 'reembolso_id')::uuid AND status = 'pendente';
  IF v_count <> 1 THEN RAISE EXCEPTION 'Registro de reembolso não encontrado.'; END IF;
END;
$$;
