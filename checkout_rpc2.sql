CREATE OR REPLACE FUNCTION public.gsa_client_checkout_store_before_zero_fix_20260817(p_sessao_id uuid, p_session_token text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_cart jsonb;
  v_sanitized_cart jsonb;
  v_item jsonb;
  v_variant public.produto_variantes%rowtype;
  v_product public.produtos%rowtype;
  v_requested integer;
  v_original_values jsonb := '[]'::jsonb;
  v_original jsonb;
  v_result jsonb;
  v_order_id uuid;
  v_snapshot jsonb;
  v_actor record;
  v_request_id uuid;
  v_existing_order public.orcamentos%rowtype;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'Dados do checkout invalidos.';
  END IF;
  v_cart := p_payload -> 'carrinho';
  IF jsonb_typeof(v_cart) <> 'array' THEN RAISE EXCEPTION 'Carrinho invalido.'; END IF;

  SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'tipo', item ->> 'tipo',
    'item_id', item ->> 'item_id',
    'quantidade', item -> 'quantidade',
    'prazo_meses', CASE WHEN item ? 'prazo_meses' THEN item -> 'prazo_meses' ELSE NULL END
  ))) INTO v_sanitized_cart
  FROM jsonb_array_elements(v_cart) source(item);

  -- Uma repeticao da mesma requisicao deve devolver o pedido ja criado sem
  -- revalidar ou baixar novamente o estoque da variante.
  IF COALESCE(p_payload ->> 'request_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    v_request_id := (p_payload ->> 'request_id')::uuid;
    SELECT * INTO v_actor
    FROM public.gsa_client_session_actor(p_sessao_id, p_session_token)
    LIMIT 1;
    SELECT * INTO v_existing_order
    FROM public.orcamentos
    WHERE checkout_request_id = v_request_id;
    IF v_existing_order.id IS NOT NULL AND v_existing_order.cliente_id = v_actor.cliente_id THEN
      RETURN public.gsa_client_checkout_store_base_20260817(
        p_sessao_id,
        p_session_token,
        jsonb_set(p_payload, '{carrinho}', v_sanitized_cart, false)
      );
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_cart) source(item)
    JOIN public.produtos p ON p.id = NULLIF(item ->> 'item_id', '')::uuid
    WHERE item ->> 'tipo' = 'produto'
      AND p.possui_variacoes
      AND COALESCE(item ->> 'variante_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ) THEN
    RAISE EXCEPTION 'Selecione todas as variacoes dos produtos antes de finalizar.';
  END IF;

  IF EXISTS (
    SELECT item ->> 'item_id'
    FROM jsonb_array_elements(v_cart) source(item)
    WHERE item ->> 'tipo' = 'produto'
    GROUP BY item ->> 'item_id'
    HAVING count(DISTINCT COALESCE(item ->> 'variante_id', '')) > 1
  ) THEN
    RAISE EXCEPTION 'Finalize uma combinacao de variacao por produto em cada pedido.';
  END IF;

  FOR v_item IN
    SELECT DISTINCT ON (item ->> 'item_id') item
    FROM jsonb_array_elements(v_cart) source(item)
    WHERE item ->> 'tipo' = 'produto' AND COALESCE(item ->> 'variante_id', '') <> ''
    ORDER BY item ->> 'item_id'
  LOOP
    SELECT * INTO v_product
    FROM public.produtos WHERE id = (v_item ->> 'item_id')::uuid FOR UPDATE;
    SELECT * INTO v_variant
    FROM public.produto_variantes
    WHERE id = (v_item ->> 'variante_id')::uuid
      AND produto_id = v_product.id AND ativo
    FOR UPDATE;
    IF v_variant.id IS NULL THEN RAISE EXCEPTION 'Variacao indisponivel para %.', v_product.nome; END IF;

    SELECT sum((item ->> 'quantidade')::integer) INTO v_requested
    FROM jsonb_array_elements(v_cart) source(item)
    WHERE item ->> 'tipo' = 'produto'
      AND item ->> 'item_id' = v_product.id::text
      AND item ->> 'variante_id' = v_variant.id::text;

    IF v_variant.controle_estoque AND v_variant.estoque_disponivel < v_requested THEN
      RAISE EXCEPTION 'Estoque insuficiente para a variacao % de %.',
        COALESCE(v_variant.nome, v_variant.combinacao::text), v_product.nome;
    END IF;

    v_original_values := v_original_values || jsonb_build_array(jsonb_build_object(
      'produto_id', v_product.id,
      'valor', v_product.valor
    ));
    IF v_variant.valor IS NOT NULL THEN
      UPDATE public.produtos SET valor = v_variant.valor WHERE id = v_product.id;
    END IF;
  END LOOP;

  v_result := public.gsa_client_checkout_store_base_20260817(
    p_sessao_id,
    p_session_token,
    jsonb_set(p_payload, '{carrinho}', v_sanitized_cart, false)
  );

  FOR v_original IN SELECT value FROM jsonb_array_elements(v_original_values)
  LOOP
    UPDATE public.produtos
    SET valor = (v_original ->> 'valor')::numeric
    WHERE id = (v_original ->> 'produto_id')::uuid;
  END LOOP;

  IF COALESCE((v_result ->> 'already_exists')::boolean, false) THEN
    RETURN v_result;
  END IF;

  v_order_id := (v_result ->> 'orcamento_id')::uuid;
  FOR v_item IN
    SELECT DISTINCT ON (item ->> 'item_id') item
    FROM jsonb_array_elements(v_cart) source(item)
    WHERE item ->> 'tipo' = 'produto' AND COALESCE(item ->> 'variante_id', '') <> ''
    ORDER BY item ->> 'item_id'
  LOOP
    SELECT * INTO v_variant FROM public.produto_variantes
    WHERE id = (v_item ->> 'variante_id')::uuid FOR UPDATE;

    -- Inclui eventuais unidades-brinde geradas pelo motor de promocoes.
    SELECT COALESCE(sum(quantidade), 0) INTO v_requested
    FROM public.loja_pedido_itens
    WHERE orcamento_id = v_order_id
      AND tipo = 'produto'
      AND produto_id = v_variant.produto_id;

    IF v_variant.controle_estoque AND v_variant.estoque_disponivel < v_requested THEN
      RAISE EXCEPTION 'Estoque insuficiente para a variacao % apos aplicar as promocoes.',
        COALESCE(v_variant.nome, v_variant.combinacao::text);
    END IF;

    v_snapshot := jsonb_build_object(
      'variante_id', v_variant.id,
      'nome', v_variant.nome,
      'sku', v_variant.sku,
      'codigo_barras', v_variant.codigo_barras,
      'opcoes', v_variant.combinacao,
      'valor_unitario', v_variant.valor,
      'imagem_url', v_variant.imagem_url,
      'quantidade', v_requested
    );

    UPDATE public.loja_pedido_itens
    SET produto_variante_id = v_variant.id,
        variacao_selecionada = v_snapshot
    WHERE orcamento_id = v_order_id
      AND tipo = 'produto' AND produto_id = v_variant.produto_id;

    UPDATE public.ordens_compra
    SET produto_variante_id = v_variant.id,
        variacao_selecionada = v_snapshot
    WHERE orcamento_id = v_order_id AND produto_id = v_variant.produto_id;

    IF v_variant.controle_estoque THEN
      UPDATE public.produto_variantes
      SET estoque_disponivel = estoque_disponivel - v_requested
      WHERE id = v_variant.id;
    END IF;
  END LOOP;

  RETURN v_result;
END;
$function$

