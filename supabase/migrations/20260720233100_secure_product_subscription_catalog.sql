-- Cadastro e inativação segura do catálogo administrativo.

CREATE OR REPLACE FUNCTION public.gsa_admin_save_product_catalog(
  p_sessao_id UUID,
  p_session_token TEXT,
  p_produto_id UUID,
  p_payload JSONB,
  p_fornecedor JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_actor RECORD;
  v_id UUID := p_produto_id;
  v_produto public.produtos%ROWTYPE;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_require_admin_actor(p_sessao_id, p_session_token);

  IF p_produto_id IS NULL THEN
    IF NULLIF(BTRIM(p_payload->>'nome'), '') IS NULL THEN
      RAISE EXCEPTION 'O nome do produto é obrigatório.';
    END IF;
    INSERT INTO public.produtos(
      nome, descricao, valor, valor_custo, porcentagem_lucro, status, tipo_cliente,
      categoria, categoria_id, ocultar_valor, visivel_na_loja, controle_estoque,
      estoque_disponivel, codigo_barras, identificador_preferencial, tipo_codigo_barras,
      imagem_url, imagem_url_2, imagem_url_3, imagem_url_4, imagem_url_5
    ) VALUES (
      BTRIM(p_payload->>'nome'), COALESCE(p_payload->>'descricao',''), (p_payload->>'valor')::NUMERIC,
      COALESCE((p_payload->>'valor_custo')::NUMERIC,0), COALESCE((p_payload->>'porcentagem_lucro')::NUMERIC,0),
      COALESCE(p_payload->>'status','ativo'), COALESCE(p_payload->>'tipo_cliente','pf'),
      NULLIF(p_payload->>'categoria',''), NULLIF(p_payload->>'categoria_id','')::UUID,
      COALESCE((p_payload->>'ocultar_valor')::BOOLEAN,false), COALESCE((p_payload->>'visivel_na_loja')::BOOLEAN,false),
      COALESCE((p_payload->>'controle_estoque')::BOOLEAN,false), COALESCE((p_payload->>'estoque_disponivel')::INTEGER,0),
      NULLIF(p_payload->>'codigo_barras',''), COALESCE(NULLIF(p_payload->>'identificador_preferencial',''),'interno'),
      NULLIF(p_payload->>'tipo_codigo_barras',''), NULLIF(p_payload->>'imagem_url',''), NULLIF(p_payload->>'imagem_url_2',''),
      NULLIF(p_payload->>'imagem_url_3',''), NULLIF(p_payload->>'imagem_url_4',''), NULLIF(p_payload->>'imagem_url_5','')
    ) RETURNING id INTO v_id;
  ELSE
    SELECT * INTO v_produto FROM public.produtos WHERE id = p_produto_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produto não encontrado.'; END IF;
    UPDATE public.produtos SET
      nome = COALESCE(NULLIF(BTRIM(p_payload->>'nome'), ''), nome),
      descricao = CASE WHEN p_payload ? 'descricao' THEN COALESCE(p_payload->>'descricao','') ELSE descricao END,
      valor = CASE WHEN p_payload ? 'valor' THEN (p_payload->>'valor')::NUMERIC ELSE valor END,
      valor_custo = CASE WHEN p_payload ? 'valor_custo' THEN COALESCE((p_payload->>'valor_custo')::NUMERIC,0) ELSE valor_custo END,
      porcentagem_lucro = CASE WHEN p_payload ? 'porcentagem_lucro' THEN COALESCE((p_payload->>'porcentagem_lucro')::NUMERIC,0) ELSE porcentagem_lucro END,
      status = COALESCE(p_payload->>'status', status),
      tipo_cliente = COALESCE(p_payload->>'tipo_cliente', tipo_cliente),
      categoria = CASE WHEN p_payload ? 'categoria' THEN NULLIF(p_payload->>'categoria','') ELSE categoria END,
      categoria_id = CASE WHEN p_payload ? 'categoria_id' THEN NULLIF(p_payload->>'categoria_id','')::UUID ELSE categoria_id END,
      ocultar_valor = CASE WHEN p_payload ? 'ocultar_valor' THEN (p_payload->>'ocultar_valor')::BOOLEAN ELSE ocultar_valor END,
      visivel_na_loja = CASE WHEN p_payload ? 'visivel_na_loja' THEN (p_payload->>'visivel_na_loja')::BOOLEAN ELSE visivel_na_loja END,
      controle_estoque = CASE WHEN p_payload ? 'controle_estoque' THEN (p_payload->>'controle_estoque')::BOOLEAN ELSE controle_estoque END,
      estoque_disponivel = CASE WHEN p_payload ? 'estoque_disponivel' THEN (p_payload->>'estoque_disponivel')::INTEGER ELSE estoque_disponivel END,
      codigo_barras = CASE WHEN p_payload ? 'codigo_barras' THEN NULLIF(p_payload->>'codigo_barras','') ELSE codigo_barras END,
      identificador_preferencial = COALESCE(NULLIF(p_payload->>'identificador_preferencial',''), identificador_preferencial),
      tipo_codigo_barras = CASE WHEN p_payload ? 'tipo_codigo_barras' THEN NULLIF(p_payload->>'tipo_codigo_barras','') ELSE tipo_codigo_barras END,
      imagem_url = CASE WHEN p_payload ? 'imagem_url' THEN NULLIF(p_payload->>'imagem_url','') ELSE imagem_url END,
      imagem_url_2 = CASE WHEN p_payload ? 'imagem_url_2' THEN NULLIF(p_payload->>'imagem_url_2','') ELSE imagem_url_2 END,
      imagem_url_3 = CASE WHEN p_payload ? 'imagem_url_3' THEN NULLIF(p_payload->>'imagem_url_3','') ELSE imagem_url_3 END,
      imagem_url_4 = CASE WHEN p_payload ? 'imagem_url_4' THEN NULLIF(p_payload->>'imagem_url_4','') ELSE imagem_url_4 END,
      imagem_url_5 = CASE WHEN p_payload ? 'imagem_url_5' THEN NULLIF(p_payload->>'imagem_url_5','') ELSE imagem_url_5 END
    WHERE id = p_produto_id;
  END IF;

  IF p_fornecedor IS NOT NULL THEN
    PERFORM public.gsa_admin_upsert_product_supplier_config(
      p_sessao_id, p_session_token, v_id, p_fornecedor
    );
  END IF;

  SELECT * INTO v_produto FROM public.produtos WHERE id = v_id;
  RETURN jsonb_build_object('success', true, 'produto', to_jsonb(v_produto));
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_save_subscription_catalog(
  p_sessao_id UUID,
  p_session_token TEXT,
  p_assinatura_id UUID,
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_actor RECORD;
  v_id UUID := p_assinatura_id;
  v_assinatura public.assinaturas%ROWTYPE;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_require_admin_actor(p_sessao_id, p_session_token);

  IF p_assinatura_id IS NULL THEN
    IF NULLIF(BTRIM(p_payload->>'nome'), '') IS NULL THEN
      RAISE EXCEPTION 'O nome da assinatura é obrigatório.';
    END IF;
    INSERT INTO public.assinaturas(
      codigo_assinatura, nome, descricao, valor, status, tipo_cliente, categoria, categoria_id,
      ocultar_valor, visivel_na_loja, imagem_url, imagem_url_2, imagem_url_3, imagem_url_4, imagem_url_5
    ) VALUES (
      'ASS-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 10)),
      BTRIM(p_payload->>'nome'), COALESCE(p_payload->>'descricao',''), (p_payload->>'valor')::NUMERIC,
      COALESCE(p_payload->>'status','ativo'), COALESCE(p_payload->>'tipo_cliente','pf'),
      NULLIF(p_payload->>'categoria',''), NULLIF(p_payload->>'categoria_id','')::UUID,
      COALESCE((p_payload->>'ocultar_valor')::BOOLEAN,false), COALESCE((p_payload->>'visivel_na_loja')::BOOLEAN,false),
      NULLIF(p_payload->>'imagem_url',''), NULLIF(p_payload->>'imagem_url_2',''), NULLIF(p_payload->>'imagem_url_3',''),
      NULLIF(p_payload->>'imagem_url_4',''), NULLIF(p_payload->>'imagem_url_5','')
    ) RETURNING id INTO v_id;
  ELSE
    SELECT * INTO v_assinatura FROM public.assinaturas WHERE id = p_assinatura_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Assinatura não encontrada.'; END IF;
    UPDATE public.assinaturas SET
      nome = COALESCE(NULLIF(BTRIM(p_payload->>'nome'), ''), nome),
      descricao = CASE WHEN p_payload ? 'descricao' THEN COALESCE(p_payload->>'descricao','') ELSE descricao END,
      valor = CASE WHEN p_payload ? 'valor' THEN (p_payload->>'valor')::NUMERIC ELSE valor END,
      status = COALESCE(p_payload->>'status', status),
      tipo_cliente = COALESCE(p_payload->>'tipo_cliente', tipo_cliente),
      categoria = CASE WHEN p_payload ? 'categoria' THEN NULLIF(p_payload->>'categoria','') ELSE categoria END,
      categoria_id = CASE WHEN p_payload ? 'categoria_id' THEN NULLIF(p_payload->>'categoria_id','')::UUID ELSE categoria_id END,
      ocultar_valor = CASE WHEN p_payload ? 'ocultar_valor' THEN (p_payload->>'ocultar_valor')::BOOLEAN ELSE ocultar_valor END,
      visivel_na_loja = CASE WHEN p_payload ? 'visivel_na_loja' THEN (p_payload->>'visivel_na_loja')::BOOLEAN ELSE visivel_na_loja END,
      imagem_url = CASE WHEN p_payload ? 'imagem_url' THEN NULLIF(p_payload->>'imagem_url','') ELSE imagem_url END,
      imagem_url_2 = CASE WHEN p_payload ? 'imagem_url_2' THEN NULLIF(p_payload->>'imagem_url_2','') ELSE imagem_url_2 END,
      imagem_url_3 = CASE WHEN p_payload ? 'imagem_url_3' THEN NULLIF(p_payload->>'imagem_url_3','') ELSE imagem_url_3 END,
      imagem_url_4 = CASE WHEN p_payload ? 'imagem_url_4' THEN NULLIF(p_payload->>'imagem_url_4','') ELSE imagem_url_4 END,
      imagem_url_5 = CASE WHEN p_payload ? 'imagem_url_5' THEN NULLIF(p_payload->>'imagem_url_5','') ELSE imagem_url_5 END
    WHERE id = p_assinatura_id;
  END IF;

  SELECT * INTO v_assinatura FROM public.assinaturas WHERE id = v_id;
  RETURN jsonb_build_object('success', true, 'assinatura', to_jsonb(v_assinatura));
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_archive_catalog_items(
  p_sessao_id UUID,
  p_session_token TEXT,
  p_tipo TEXT,
  p_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_actor RECORD;
  v_count INTEGER := 0;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_require_admin_actor(p_sessao_id, p_session_token);

  IF p_tipo = 'produto' THEN
    UPDATE public.produtos SET status = 'inativo', visivel_na_loja = false WHERE id = ANY(p_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
  ELSIF p_tipo = 'assinatura' THEN
    UPDATE public.assinaturas SET status = 'inativo', visivel_na_loja = false WHERE id = ANY(p_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
  ELSE
    RAISE EXCEPTION 'Tipo de catálogo inválido.';
  END IF;

  RETURN jsonb_build_object('success', true, 'updated', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_save_product_catalog(UUID, TEXT, UUID, JSONB, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_save_subscription_catalog(UUID, TEXT, UUID, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_archive_catalog_items(UUID, TEXT, TEXT, UUID[]) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.gsa_admin_save_product_catalog(UUID, TEXT, UUID, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_save_subscription_catalog(UUID, TEXT, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_archive_catalog_items(UUID, TEXT, TEXT, UUID[]) TO authenticated;
