-- Variacoes de produtos no catalogo, importacao, carrinho e checkout.
-- Mantem os atributos normalizados e grava um snapshot imutavel no pedido.

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS possui_variacoes boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.produto_variacao_grupos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  chave text NOT NULL,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'outro'
    CHECK (tipo IN ('cor', 'tamanho', 'numero', 'material', 'modelo', 'outro')),
  ordem integer NOT NULL DEFAULT 0,
  origem_externa_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT produto_variacao_grupos_produto_chave_key UNIQUE (produto_id, chave)
);

CREATE TABLE IF NOT EXISTS public.produto_variacao_opcoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id uuid NOT NULL REFERENCES public.produto_variacao_grupos(id) ON DELETE CASCADE,
  chave text NOT NULL,
  nome text NOT NULL,
  valor text,
  cor_hex text,
  imagem_url text,
  ordem integer NOT NULL DEFAULT 0,
  origem_externa_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT produto_variacao_opcoes_grupo_chave_key UNIQUE (grupo_id, chave)
);

CREATE TABLE IF NOT EXISTS public.produto_variantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  chave text NOT NULL,
  nome text,
  sku text,
  codigo_barras text,
  valor numeric,
  valor_custo numeric,
  controle_estoque boolean NOT NULL DEFAULT false,
  estoque_disponivel integer NOT NULL DEFAULT 0,
  imagem_url text,
  ativo boolean NOT NULL DEFAULT true,
  combinacao jsonb NOT NULL DEFAULT '{}'::jsonb,
  combinacao_hash text NOT NULL,
  origem_externa_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT produto_variantes_valor_check CHECK (valor IS NULL OR valor >= 0),
  CONSTRAINT produto_variantes_valor_custo_check CHECK (valor_custo IS NULL OR valor_custo >= 0),
  CONSTRAINT produto_variantes_estoque_check CHECK (estoque_disponivel >= 0),
  CONSTRAINT produto_variantes_produto_hash_key UNIQUE (produto_id, combinacao_hash),
  CONSTRAINT produto_variantes_produto_chave_key UNIQUE (produto_id, chave)
);

CREATE TABLE IF NOT EXISTS public.produto_variante_opcoes (
  variante_id uuid NOT NULL REFERENCES public.produto_variantes(id) ON DELETE CASCADE,
  grupo_id uuid NOT NULL REFERENCES public.produto_variacao_grupos(id) ON DELETE CASCADE,
  opcao_id uuid NOT NULL REFERENCES public.produto_variacao_opcoes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (variante_id, grupo_id),
  CONSTRAINT produto_variante_opcoes_variante_opcao_key UNIQUE (variante_id, opcao_id)
);

CREATE INDEX IF NOT EXISTS idx_produto_variacao_grupos_produto
  ON public.produto_variacao_grupos(produto_id, ordem, id);
CREATE INDEX IF NOT EXISTS idx_produto_variacao_opcoes_grupo
  ON public.produto_variacao_opcoes(grupo_id, ordem, id);
CREATE INDEX IF NOT EXISTS idx_produto_variantes_produto
  ON public.produto_variantes(produto_id, ativo, id);
CREATE INDEX IF NOT EXISTS idx_produto_variante_opcoes_opcao
  ON public.produto_variante_opcoes(opcao_id);

ALTER TABLE public.loja_carrinhos
  ADD COLUMN IF NOT EXISTS produto_variante_id uuid
    REFERENCES public.produto_variantes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS opcoes_variacao jsonb;

ALTER TABLE public.loja_pedido_itens
  ADD COLUMN IF NOT EXISTS produto_variante_id uuid
    REFERENCES public.produto_variantes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS variacao_selecionada jsonb;

ALTER TABLE public.ordens_compra
  ADD COLUMN IF NOT EXISTS produto_variante_id uuid
    REFERENCES public.produto_variantes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS variacao_selecionada jsonb;

CREATE INDEX IF NOT EXISTS idx_loja_carrinhos_produto_variante
  ON public.loja_carrinhos(produto_variante_id);
CREATE INDEX IF NOT EXISTS idx_loja_pedido_itens_produto_variante
  ON public.loja_pedido_itens(produto_variante_id);
CREATE INDEX IF NOT EXISTS idx_ordens_compra_produto_variante
  ON public.ordens_compra(produto_variante_id);

ALTER TABLE public.produto_variacao_grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produto_variacao_opcoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produto_variantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produto_variante_opcoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS produto_variacao_grupos_catalogo_select ON public.produto_variacao_grupos;
CREATE POLICY produto_variacao_grupos_catalogo_select
  ON public.produto_variacao_grupos FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.produtos p
    WHERE p.id = produto_variacao_grupos.produto_id
      AND p.status = 'ativo' AND p.visivel_na_loja = true
  ));

DROP POLICY IF EXISTS produto_variacao_opcoes_catalogo_select ON public.produto_variacao_opcoes;
CREATE POLICY produto_variacao_opcoes_catalogo_select
  ON public.produto_variacao_opcoes FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.produto_variacao_grupos g
    JOIN public.produtos p ON p.id = g.produto_id
    WHERE g.id = produto_variacao_opcoes.grupo_id
      AND p.status = 'ativo' AND p.visivel_na_loja = true
  ));

DROP POLICY IF EXISTS produto_variantes_catalogo_select ON public.produto_variantes;
CREATE POLICY produto_variantes_catalogo_select
  ON public.produto_variantes FOR SELECT TO anon, authenticated
  USING (ativo AND EXISTS (
    SELECT 1 FROM public.produtos p
    WHERE p.id = produto_variantes.produto_id
      AND p.status = 'ativo' AND p.visivel_na_loja = true
  ));

DROP POLICY IF EXISTS produto_variante_opcoes_catalogo_select ON public.produto_variante_opcoes;
CREATE POLICY produto_variante_opcoes_catalogo_select
  ON public.produto_variante_opcoes FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.produto_variantes v
    JOIN public.produtos p ON p.id = v.produto_id
    WHERE v.id = produto_variante_opcoes.variante_id
      AND v.ativo AND p.status = 'ativo' AND p.visivel_na_loja = true
  ));

REVOKE INSERT, UPDATE, DELETE ON public.produto_variacao_grupos FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.produto_variacao_opcoes FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.produto_variantes FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.produto_variante_opcoes FROM anon, authenticated;
GRANT SELECT ON public.produto_variacao_grupos TO anon, authenticated;
GRANT SELECT ON public.produto_variacao_opcoes TO anon, authenticated;
GRANT SELECT ON public.produto_variantes TO anon, authenticated;
GRANT SELECT ON public.produto_variante_opcoes TO anon, authenticated;
GRANT ALL ON public.produto_variacao_grupos TO service_role;
GRANT ALL ON public.produto_variacao_opcoes TO service_role;
GRANT ALL ON public.produto_variantes TO service_role;
GRANT ALL ON public.produto_variante_opcoes TO service_role;

CREATE OR REPLACE FUNCTION public.gsa_touch_product_variation_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_produto_variacao_grupos_updated_at ON public.produto_variacao_grupos;
CREATE TRIGGER trg_produto_variacao_grupos_updated_at
BEFORE UPDATE ON public.produto_variacao_grupos
FOR EACH ROW EXECUTE FUNCTION public.gsa_touch_product_variation_updated_at();

DROP TRIGGER IF EXISTS trg_produto_variacao_opcoes_updated_at ON public.produto_variacao_opcoes;
CREATE TRIGGER trg_produto_variacao_opcoes_updated_at
BEFORE UPDATE ON public.produto_variacao_opcoes
FOR EACH ROW EXECUTE FUNCTION public.gsa_touch_product_variation_updated_at();

DROP TRIGGER IF EXISTS trg_produto_variantes_updated_at ON public.produto_variantes;
CREATE TRIGGER trg_produto_variantes_updated_at
BEFORE UPDATE ON public.produto_variantes
FOR EACH ROW EXECUTE FUNCTION public.gsa_touch_product_variation_updated_at();

-- Funcao interna: substitui a grade completa de variacoes do produto.
CREATE OR REPLACE FUNCTION public.gsa_replace_product_variations(
  p_produto_id uuid,
  p_variacoes jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_groups jsonb := COALESCE(p_variacoes -> 'grupos', '[]'::jsonb);
  v_variants jsonb := COALESCE(p_variacoes -> 'variantes', '[]'::jsonb);
  v_group jsonb;
  v_option jsonb;
  v_variant jsonb;
  v_group_id uuid;
  v_option_id uuid;
  v_variant_id uuid;
  v_group_key text;
  v_option_key text;
  v_variant_key text;
  v_group_index integer := 0;
  v_option_index integer;
  v_variant_index integer := 0;
  v_group_map jsonb := '{}'::jsonb;
  v_option_map jsonb := '{}'::jsonb;
  v_selections jsonb;
  v_selection record;
  v_group_name text;
  v_option_name text;
  v_combination jsonb;
  v_hash_source text;
  v_hash text;
  v_margin numeric;
  v_cost numeric;
  v_value numeric;
  v_stock integer;
  v_control_stock boolean;
  v_group_count integer;
  v_variant_count integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.produtos WHERE id = p_produto_id) THEN
    RAISE EXCEPTION 'Produto nao encontrado.';
  END IF;

  IF jsonb_typeof(v_groups) <> 'array' OR jsonb_typeof(v_variants) <> 'array' THEN
    RAISE EXCEPTION 'A grade de variacoes deve conter listas de grupos e variantes.';
  END IF;

  v_group_count := jsonb_array_length(v_groups);
  v_variant_count := jsonb_array_length(v_variants);
  IF v_group_count > 5 THEN RAISE EXCEPTION 'Limite de 5 grupos de variacao excedido.'; END IF;
  IF v_variant_count > 500 THEN RAISE EXCEPTION 'Limite de 500 combinacoes excedido.'; END IF;

  DELETE FROM public.produto_variantes WHERE produto_id = p_produto_id;
  DELETE FROM public.produto_variacao_grupos WHERE produto_id = p_produto_id;

  IF v_group_count = 0 OR v_variant_count = 0 THEN
    UPDATE public.produtos SET possui_variacoes = false WHERE id = p_produto_id;
    RETURN jsonb_build_object('grupos', 0, 'opcoes', 0, 'variantes', 0);
  END IF;

  SELECT COALESCE(porcentagem_lucro, 0) INTO v_margin
  FROM public.produtos WHERE id = p_produto_id;

  FOR v_group IN SELECT value FROM jsonb_array_elements(v_groups)
  LOOP
    v_group_index := v_group_index + 1;
    v_group_key := COALESCE(NULLIF(trim(v_group ->> 'chave'), ''), 'grupo_' || v_group_index);
    IF COALESCE(NULLIF(trim(v_group ->> 'nome'), ''), '') = '' THEN
      RAISE EXCEPTION 'Todo grupo de variacao precisa de nome.';
    END IF;
    IF jsonb_typeof(COALESCE(v_group -> 'opcoes', '[]'::jsonb)) <> 'array'
       OR jsonb_array_length(COALESCE(v_group -> 'opcoes', '[]'::jsonb)) = 0 THEN
      RAISE EXCEPTION 'O grupo % precisa de pelo menos uma opcao.', v_group ->> 'nome';
    END IF;

    INSERT INTO public.produto_variacao_grupos(
      produto_id, chave, nome, tipo, ordem, origem_externa_id
    ) VALUES (
      p_produto_id,
      v_group_key,
      left(trim(v_group ->> 'nome'), 80),
      CASE WHEN COALESCE(v_group ->> 'tipo', 'outro') IN ('cor','tamanho','numero','material','modelo','outro')
        THEN COALESCE(v_group ->> 'tipo', 'outro') ELSE 'outro' END,
      COALESCE(NULLIF(v_group ->> 'ordem', '')::integer, v_group_index - 1),
      NULLIF(v_group ->> 'origem_externa_id', '')
    ) RETURNING id INTO v_group_id;

    v_group_map := v_group_map || jsonb_build_object(v_group_key, v_group_id::text);
    v_option_index := 0;

    FOR v_option IN SELECT value FROM jsonb_array_elements(v_group -> 'opcoes')
    LOOP
      v_option_index := v_option_index + 1;
      v_option_key := COALESCE(NULLIF(trim(v_option ->> 'chave'), ''), 'opcao_' || v_option_index);
      IF COALESCE(NULLIF(trim(v_option ->> 'nome'), ''), '') = '' THEN
        RAISE EXCEPTION 'Toda opcao de variacao precisa de nome.';
      END IF;

      INSERT INTO public.produto_variacao_opcoes(
        grupo_id, chave, nome, valor, cor_hex, imagem_url, ordem, origem_externa_id
      ) VALUES (
        v_group_id,
        v_option_key,
        left(trim(v_option ->> 'nome'), 120),
        NULLIF(v_option ->> 'valor', ''),
        NULLIF(v_option ->> 'cor_hex', ''),
        NULLIF(v_option ->> 'imagem_url', ''),
        COALESCE(NULLIF(v_option ->> 'ordem', '')::integer, v_option_index - 1),
        NULLIF(v_option ->> 'origem_externa_id', '')
      ) RETURNING id INTO v_option_id;

      v_option_map := v_option_map || jsonb_build_object(
        v_group_key || '::' || v_option_key,
        v_option_id::text
      );
    END LOOP;
  END LOOP;

  FOR v_variant IN SELECT value FROM jsonb_array_elements(v_variants)
  LOOP
    v_variant_index := v_variant_index + 1;
    v_selections := COALESCE(v_variant -> 'selecoes', '{}'::jsonb);
    IF jsonb_typeof(v_selections) <> 'object'
       OR (SELECT count(*) FROM jsonb_object_keys(v_selections)) <> v_group_count THEN
      RAISE EXCEPTION 'A combinacao % nao informa uma opcao de cada grupo.', v_variant_index;
    END IF;

    SELECT string_agg(key || '=' || value, '|' ORDER BY key)
      INTO v_hash_source
    FROM jsonb_each_text(v_selections);
    v_hash := md5(COALESCE(v_hash_source, ''));
    v_variant_key := COALESCE(NULLIF(trim(v_variant ->> 'chave'), ''), 'variante_' || v_hash);
    v_combination := '{}'::jsonb;
    v_cost := NULLIF(v_variant ->> 'valor_custo', '')::numeric;
    v_value := NULLIF(v_variant ->> 'valor', '')::numeric;
    IF v_value IS NULL AND v_cost IS NOT NULL THEN
      v_value := round(v_cost * (1 + v_margin / 100), 2);
    END IF;
    v_stock := GREATEST(COALESCE(NULLIF(v_variant ->> 'estoque_disponivel', '')::integer, 0), 0);
    v_control_stock := COALESCE(NULLIF(v_variant ->> 'controle_estoque', '')::boolean, v_variant ? 'estoque_disponivel');

    INSERT INTO public.produto_variantes(
      produto_id, chave, nome, sku, codigo_barras, valor, valor_custo,
      controle_estoque, estoque_disponivel, imagem_url, ativo,
      combinacao, combinacao_hash, origem_externa_id
    ) VALUES (
      p_produto_id,
      v_variant_key,
      NULLIF(left(trim(COALESCE(v_variant ->> 'nome', '')), 180), ''),
      NULLIF(left(trim(COALESCE(v_variant ->> 'sku', '')), 100), ''),
      NULLIF(regexp_replace(COALESCE(v_variant ->> 'codigo_barras', ''), '[^0-9A-Za-z_-]', '', 'g'), ''),
      v_value,
      v_cost,
      v_control_stock,
      v_stock,
      NULLIF(v_variant ->> 'imagem_url', ''),
      COALESCE(NULLIF(v_variant ->> 'ativo', '')::boolean, true),
      '{}'::jsonb,
      v_hash,
      NULLIF(v_variant ->> 'origem_externa_id', '')
    ) RETURNING id INTO v_variant_id;

    FOR v_selection IN SELECT key, value FROM jsonb_each_text(v_selections)
    LOOP
      v_group_id := NULLIF(v_group_map ->> v_selection.key, '')::uuid;
      v_option_id := NULLIF(v_option_map ->> (v_selection.key || '::' || v_selection.value), '')::uuid;
      IF v_group_id IS NULL OR v_option_id IS NULL THEN
        RAISE EXCEPTION 'Opcao de variacao desconhecida: % = %.', v_selection.key, v_selection.value;
      END IF;

      SELECT nome INTO v_group_name FROM public.produto_variacao_grupos WHERE id = v_group_id;
      SELECT nome INTO v_option_name FROM public.produto_variacao_opcoes WHERE id = v_option_id;
      v_combination := v_combination || jsonb_build_object(v_group_name, v_option_name);

      INSERT INTO public.produto_variante_opcoes(variante_id, grupo_id, opcao_id)
      VALUES (v_variant_id, v_group_id, v_option_id);
    END LOOP;

    UPDATE public.produto_variantes SET combinacao = v_combination WHERE id = v_variant_id;
  END LOOP;

  UPDATE public.produtos p
  SET possui_variacoes = true,
      valor = COALESCE((SELECT min(v.valor) FROM public.produto_variantes v WHERE v.produto_id = p.id AND v.ativo AND v.valor IS NOT NULL), p.valor),
      valor_custo = COALESCE((SELECT min(v.valor_custo) FROM public.produto_variantes v WHERE v.produto_id = p.id AND v.ativo AND v.valor_custo IS NOT NULL), p.valor_custo),
      controle_estoque = CASE
        WHEN EXISTS (SELECT 1 FROM public.produto_variantes v WHERE v.produto_id = p.id AND v.ativo AND v.controle_estoque)
        THEN true ELSE p.controle_estoque END,
      estoque_disponivel = CASE
        WHEN EXISTS (SELECT 1 FROM public.produto_variantes v WHERE v.produto_id = p.id AND v.ativo AND v.controle_estoque)
        THEN (SELECT COALESCE(sum(v.estoque_disponivel), 0) FROM public.produto_variantes v WHERE v.produto_id = p.id AND v.ativo)
        ELSE p.estoque_disponivel END
  WHERE p.id = p_produto_id;

  -- Mantem a vitrine coerente quando o menor preco da grade muda.
  UPDATE public.produtos p
  SET valor_promocional = CASE
        WHEN p.desconto_ativo THEN public.gsa_calculate_product_effective_price(
          p.valor,
          p.desconto_ativo,
          p.desconto_tipo,
          p.desconto_valor,
          p.desconto_prazo_tipo,
          p.desconto_fim_em
        )
        ELSE p.valor_promocional
      END,
      desconto_percentual = CASE
        WHEN p.desconto_ativo AND p.desconto_tipo = 'porcentagem'
          THEN GREATEST(0, LEAST(100, COALESCE(p.desconto_valor, 0)))
        WHEN p.desconto_ativo AND p.valor > 0
          THEN round(((p.valor - public.gsa_calculate_product_effective_price(
            p.valor,
            p.desconto_ativo,
            p.desconto_tipo,
            p.desconto_valor,
            p.desconto_prazo_tipo,
            p.desconto_fim_em
          )) / p.valor) * 100, 2)
        ELSE p.desconto_percentual
      END
  WHERE p.id = p_produto_id;

  RETURN jsonb_build_object(
    'grupos', v_group_count,
    'opcoes', (SELECT count(*) FROM public.produto_variacao_opcoes o JOIN public.produto_variacao_grupos g ON g.id = o.grupo_id WHERE g.produto_id = p_produto_id),
    'variantes', v_variant_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_replace_product_variations(uuid, jsonb) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_replace_product_variations(uuid, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.gsa_admin_get_product_variations(
  p_sessao_id uuid,
  p_session_token text,
  p_produto_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor record;
  v_groups jsonb;
  v_variants jsonb;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token) LIMIT 1;
  IF v_actor.ator_id IS NULL THEN RAISE EXCEPTION 'Sessao administrativa invalida.'; END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', g.id, 'chave', g.chave, 'nome', g.nome, 'tipo', g.tipo,
      'ordem', g.ordem, 'origem_externa_id', g.origem_externa_id,
      'opcoes', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', o.id, 'chave', o.chave, 'nome', o.nome, 'valor', o.valor,
          'cor_hex', o.cor_hex, 'imagem_url', o.imagem_url, 'ordem', o.ordem,
          'origem_externa_id', o.origem_externa_id
        ) ORDER BY o.ordem, o.id)
        FROM public.produto_variacao_opcoes o WHERE o.grupo_id = g.id
      ), '[]'::jsonb)
    ) ORDER BY g.ordem, g.id
  ), '[]'::jsonb) INTO v_groups
  FROM public.produto_variacao_grupos g WHERE g.produto_id = p_produto_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', v.id, 'chave', v.chave, 'nome', v.nome, 'sku', v.sku,
      'codigo_barras', v.codigo_barras, 'valor', v.valor, 'valor_custo', v.valor_custo,
      'controle_estoque', v.controle_estoque, 'estoque_disponivel', v.estoque_disponivel,
      'imagem_url', v.imagem_url, 'ativo', v.ativo, 'combinacao', v.combinacao,
      'origem_externa_id', v.origem_externa_id,
      'selecoes', COALESCE((
        SELECT jsonb_object_agg(g.chave, o.chave)
        FROM public.produto_variante_opcoes vo
        JOIN public.produto_variacao_grupos g ON g.id = vo.grupo_id
        JOIN public.produto_variacao_opcoes o ON o.id = vo.opcao_id
        WHERE vo.variante_id = v.id
      ), '{}'::jsonb)
    ) ORDER BY v.created_at, v.id
  ), '[]'::jsonb) INTO v_variants
  FROM public.produto_variantes v WHERE v.produto_id = p_produto_id;

  RETURN jsonb_build_object('grupos', v_groups, 'variantes', v_variants);
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_get_product_variations(uuid, text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_get_product_variations(uuid, text, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.gsa_admin_sync_product_variations(
  p_sessao_id uuid,
  p_session_token text,
  p_produto_id uuid,
  p_variacoes jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor record;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token) LIMIT 1;
  IF v_actor.ator_id IS NULL THEN RAISE EXCEPTION 'Sessao administrativa invalida.'; END IF;
  RETURN public.gsa_replace_product_variations(p_produto_id, p_variacoes);
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_sync_product_variations(uuid, text, uuid, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_sync_product_variations(uuid, text, uuid, jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.gsa_admin_save_product_catalog_v2(
  p_sessao_id uuid,
  p_session_token text,
  p_produto_id uuid,
  p_payload jsonb,
  p_fornecedor jsonb DEFAULT NULL,
  p_variacoes jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
  v_produto_id uuid;
  v_produto public.produtos%rowtype;
BEGIN
  v_result := public.gsa_admin_save_product_catalog(
    p_sessao_id, p_session_token, p_produto_id, p_payload, p_fornecedor
  );
  v_produto_id := (v_result -> 'produto' ->> 'id')::uuid;
  IF p_variacoes IS NOT NULL THEN
    PERFORM public.gsa_replace_product_variations(v_produto_id, p_variacoes);
    SELECT * INTO v_produto FROM public.produtos WHERE id = v_produto_id;
    v_result := jsonb_set(v_result, '{produto}', to_jsonb(v_produto), true);
  END IF;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_save_product_catalog_v2(uuid, text, uuid, jsonb, jsonb, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_save_product_catalog_v2(uuid, text, uuid, jsonb, jsonb, jsonb) TO authenticated, service_role;

-- A v3 preserva o importador atual e sincroniza a grade retornada pela automacao.
CREATE OR REPLACE FUNCTION public.gsa_admin_import_products_batch_v3(
  p_sessao_id uuid,
  p_session_token text,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
  v_created jsonb;
  v_input jsonb;
BEGIN
  v_result := public.gsa_admin_import_products_batch_v2(p_sessao_id, p_session_token, p_items);

  FOR v_created IN SELECT value FROM jsonb_array_elements(COALESCE(v_result -> 'created', '[]'::jsonb))
  LOOP
    SELECT item INTO v_input
    FROM jsonb_array_elements(p_items) AS source(item)
    WHERE item ->> 'client_id' = v_created ->> 'client_id'
    LIMIT 1;

    IF v_input IS NOT NULL
       AND jsonb_typeof(v_input -> 'variacoes') = 'object'
       AND jsonb_array_length(COALESCE(v_input -> 'variacoes' -> 'grupos', '[]'::jsonb)) > 0 THEN
      PERFORM public.gsa_replace_product_variations(
        (v_created ->> 'produto_id')::uuid,
        v_input -> 'variacoes'
      );
    END IF;
  END LOOP;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_import_products_batch_v3(uuid, text, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_import_products_batch_v3(uuid, text, jsonb) TO authenticated, service_role;

-- Encapsula a escrita operacional existente para aceitar a variante no carrinho
-- sem ampliar o conjunto generico de colunas editaveis pelo navegador.
DO $$
BEGIN
  IF to_regprocedure('public.gsa_client_operational_write_base_20260817(uuid,text,text,text,jsonb,jsonb)') IS NULL THEN
    ALTER FUNCTION public.gsa_client_operational_write(uuid, text, text, text, jsonb, jsonb)
      RENAME TO gsa_client_operational_write_base_20260817;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_client_operational_write_base_20260817(uuid, text, text, text, jsonb, jsonb)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_client_operational_write_base_20260817(uuid, text, text, text, jsonb, jsonb)
  TO service_role;

CREATE OR REPLACE FUNCTION public.gsa_client_operational_write(
  p_sessao_id uuid,
  p_session_token text,
  p_table text,
  p_action text,
  p_data jsonb DEFAULT '{}'::jsonb,
  p_filter jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
  v_actor record;
  v_variant public.produto_variantes%rowtype;
  v_product_id uuid;
  v_cart_id uuid;
  v_variant_id uuid;
  v_snapshot jsonb;
  v_row jsonb;
BEGIN
  IF lower(trim(COALESCE(p_table, ''))) = 'loja_carrinhos'
     AND lower(trim(COALESCE(p_action, ''))) IN ('insert', 'update') THEN
    SELECT * INTO v_actor FROM public.gsa_client_session_actor(p_sessao_id, p_session_token) LIMIT 1;
    IF v_actor.cliente_id IS NULL THEN RAISE EXCEPTION 'Sessao de cliente invalida.'; END IF;

    IF lower(trim(COALESCE(p_action, ''))) = 'insert' THEN
      v_product_id := CASE WHEN p_data ->> 'tipo' = 'produto' THEN NULLIF(p_data ->> 'item_id', '')::uuid ELSE NULL END;
    ELSE
      SELECT item_id INTO v_product_id
      FROM public.loja_carrinhos
      WHERE id = NULLIF(p_filter ->> 'id', '')::uuid
        AND cliente_id = v_actor.cliente_id AND tipo = 'produto';
    END IF;

    v_variant_id := COALESCE(
      NULLIF(p_data ->> 'produto_variante_id', '')::uuid,
      NULLIF(p_data ->> 'variante_id', '')::uuid
    );

    IF v_product_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.produtos WHERE id = v_product_id AND possui_variacoes)
       AND lower(trim(COALESCE(p_action, ''))) = 'insert'
       AND v_variant_id IS NULL THEN
      RAISE EXCEPTION 'Selecione cor, tamanho ou outra variacao antes de adicionar o produto.';
    END IF;

    IF v_variant_id IS NOT NULL THEN
      SELECT * INTO v_variant
      FROM public.produto_variantes
      WHERE id = v_variant_id AND produto_id = v_product_id AND ativo;
      IF v_variant.id IS NULL THEN RAISE EXCEPTION 'Variacao de produto invalida ou indisponivel.'; END IF;
      v_snapshot := jsonb_build_object(
        'variante_id', v_variant.id,
        'nome', v_variant.nome,
        'sku', v_variant.sku,
        'opcoes', v_variant.combinacao,
        'valor', v_variant.valor,
        'imagem_url', v_variant.imagem_url,
        'controle_estoque', v_variant.controle_estoque,
        'estoque_disponivel', v_variant.estoque_disponivel
      );
    END IF;
  END IF;

  v_result := public.gsa_client_operational_write_base_20260817(
    p_sessao_id,
    p_session_token,
    p_table,
    p_action,
    COALESCE(p_data, '{}'::jsonb) - 'produto_variante_id' - 'variante_id' - 'opcoes_variacao',
    p_filter
  );

  IF v_variant_id IS NOT NULL
     AND lower(trim(COALESCE(p_table, ''))) = 'loja_carrinhos'
     AND lower(trim(COALESCE(p_action, ''))) IN ('insert', 'update') THEN
    v_cart_id := COALESCE(
      NULLIF(v_result -> 'data' ->> 'id', '')::uuid,
      NULLIF(p_filter ->> 'id', '')::uuid
    );
    UPDATE public.loja_carrinhos
    SET produto_variante_id = v_variant_id,
        opcoes_variacao = v_snapshot
    WHERE id = v_cart_id AND cliente_id = v_actor.cliente_id
    RETURNING to_jsonb(loja_carrinhos.*) INTO v_row;
    v_result := jsonb_set(v_result, '{data}', COALESCE(v_row, 'null'::jsonb), true);
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_client_operational_write(uuid, text, text, text, jsonb, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.gsa_client_operational_write(uuid, text, text, text, jsonb, jsonb) TO authenticated, service_role;

-- O checkout-base continua responsavel por promocoes, cupons, pontos e credito.
-- O wrapper trava a variante, aplica seu preco apenas dentro da transacao,
-- delega o calculo existente e depois grava o snapshot escolhido.
DO $$
BEGIN
  IF to_regprocedure('public.gsa_client_checkout_store_base_20260817(uuid,text,jsonb)') IS NULL THEN
    ALTER FUNCTION public.gsa_client_checkout_store(uuid, text, jsonb)
      RENAME TO gsa_client_checkout_store_base_20260817;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_client_checkout_store_base_20260817(uuid, text, jsonb)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_client_checkout_store_base_20260817(uuid, text, jsonb)
  TO service_role;

CREATE OR REPLACE FUNCTION public.gsa_client_checkout_store(
  p_sessao_id uuid,
  p_session_token text,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cart jsonb;
  v_sanitized_cart jsonb;
  v_item jsonb;
  v_variant public.produto_variantes%rowtype;
  v_product public.produtos%rowtype;
  v_cliente public.clientes%rowtype;
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
    'variante_id', nullif(COALESCE(item ->> 'variante_id', item ->> 'produto_variante_id'), ''),
    'produto_variante_id', nullif(COALESCE(item ->> 'produto_variante_id', item ->> 'variante_id'), ''),
    'prazo_meses', CASE WHEN item ? 'prazo_meses' THEN item -> 'prazo_meses' ELSE NULL END
  ))) INTO v_sanitized_cart
  FROM jsonb_array_elements(v_cart) source(item);

  -- 1. Travar clientes para manter ordem canonica global contra deadlocks
  SELECT * INTO v_actor
  FROM public.gsa_client_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  IF v_actor.cliente_id IS NULL THEN
    RAISE EXCEPTION 'Sessao invalida ou expirada.';
  END IF;

  SELECT * INTO v_cliente
  FROM public.clientes
  WHERE id = v_actor.cliente_id
  FOR UPDATE;

  IF v_cliente.id IS NULL OR COALESCE(v_cliente.status, 'ativo') <> 'ativo' THEN
    RAISE EXCEPTION 'O cadastro do cliente nao esta ativo.';
  END IF;

  -- Uma repeticao da mesma requisicao deve devolver o pedido ja criado sem
  -- revalidar ou baixar novamente o estoque da variante.
  IF COALESCE(p_payload ->> 'request_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    v_request_id := (p_payload ->> 'request_id')::uuid;
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
      AND COALESCE(item ->> 'variante_id', item ->> 'produto_variante_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ) THEN
    RAISE EXCEPTION 'Selecione todas as variacoes dos produtos antes de finalizar.';
  END IF;

  -- Travar produtos e variantes em ordem canonica estrita para prevenir deadlocks
  FOR v_item IN
    SELECT jsonb_build_object(
      'item_id', item ->> 'item_id',
      'variante_id', COALESCE(item ->> 'variante_id', item ->> 'produto_variante_id')
    )
    FROM jsonb_array_elements(v_cart) source(item)
    WHERE item ->> 'tipo' = 'produto'
      AND COALESCE(item ->> 'variante_id', item ->> 'produto_variante_id', '') <> ''
    GROUP BY item ->> 'item_id', COALESCE(item ->> 'variante_id', item ->> 'produto_variante_id')
    ORDER BY item ->> 'item_id', COALESCE(item ->> 'variante_id', item ->> 'produto_variante_id')
  LOOP
    SELECT * INTO v_product
    FROM public.produtos WHERE id = (v_item ->> 'item_id')::uuid FOR UPDATE;

    SELECT * INTO v_variant
    FROM public.produto_variantes
    WHERE id = (v_item ->> 'variante_id')::uuid
      AND produto_id = v_product.id AND ativo
    FOR UPDATE;

    IF v_variant.id IS NULL THEN
      RAISE EXCEPTION 'Variacao indisponivel para %.', v_product.nome;
    END IF;

    SELECT sum((item ->> 'quantidade')::integer) INTO v_requested
    FROM jsonb_array_elements(v_cart) source(item)
    WHERE item ->> 'tipo' = 'produto'
      AND item ->> 'item_id' = v_product.id::text
      AND COALESCE(item ->> 'variante_id', item ->> 'produto_variante_id') = v_variant.id::text;

    IF v_variant.controle_estoque AND v_variant.estoque_disponivel < v_requested THEN
      RAISE EXCEPTION 'Estoque insuficiente para a variacao % de %.',
        COALESCE(v_variant.nome, v_variant.combinacao::text), v_product.nome;
    END IF;
  END LOOP;

  v_result := public.gsa_client_checkout_store_base_20260817(
    p_sessao_id,
    p_session_token,
    jsonb_set(p_payload, '{carrinho}', v_sanitized_cart, false)
  );

  IF COALESCE((v_result ->> 'already_exists')::boolean, false) THEN
    RETURN v_result;
  END IF;

  v_order_id := (v_result ->> 'orcamento_id')::uuid;
  FOR v_item IN
    SELECT jsonb_build_object(
      'item_id', item ->> 'item_id',
      'variante_id', COALESCE(item ->> 'variante_id', item ->> 'produto_variante_id')
    )
    FROM jsonb_array_elements(v_cart) source(item)
    WHERE item ->> 'tipo' = 'produto'
      AND COALESCE(item ->> 'variante_id', item ->> 'produto_variante_id', '') <> ''
    GROUP BY item ->> 'item_id', COALESCE(item ->> 'variante_id', item ->> 'produto_variante_id')
    ORDER BY item ->> 'item_id', COALESCE(item ->> 'variante_id', item ->> 'produto_variante_id')
  LOOP
    SELECT * INTO v_variant FROM public.produto_variantes
    WHERE id = (v_item ->> 'variante_id')::uuid FOR UPDATE;

    -- Inclui eventuais unidades-brinde geradas pelo motor de promocoes.
    SELECT COALESCE(sum(quantidade), 0) INTO v_requested
    FROM public.loja_pedido_itens
    WHERE orcamento_id = v_order_id
      AND tipo = 'produto'
      AND produto_id = v_variant.produto_id
      AND produto_variante_id = v_variant.id;

    -- Fallback de seguranca caso loja_pedido_itens nao tenha somado por algum motivo
    IF v_requested = 0 THEN
      SELECT COALESCE(sum((item ->> 'quantidade')::integer), 0) INTO v_requested
      FROM jsonb_array_elements(v_cart) source(item)
      WHERE item ->> 'tipo' = 'produto'
        AND item ->> 'item_id' = v_variant.produto_id::text
        AND COALESCE(item ->> 'variante_id', item ->> 'produto_variante_id') = v_variant.id::text;
    END IF;

    IF v_variant.controle_estoque AND v_variant.estoque_disponivel < v_requested THEN
      RAISE EXCEPTION 'Estoque insuficiente para a variacao % apos aplicar as promocoes.',
        COALESCE(v_variant.nome, v_variant.combinacao::text);
    END IF;

    v_snapshot := jsonb_build_object(
      'variante_id', v_variant.id,
      'produto_variante_id', v_variant.id,
      'nome', v_variant.nome,
      'sku', v_variant.sku,
      'codigo_barras', v_variant.codigo_barras,
      'opcoes', v_variant.combinacao,
      'valor_unitario', v_variant.valor,
      'imagem_url', v_variant.imagem_url,
      'quantidade', v_requested
    );

    UPDATE public.loja_pedido_itens
    SET variacao_selecionada = v_snapshot,
        produto_variante_id = v_variant.id
    WHERE orcamento_id = v_order_id
      AND tipo = 'produto' AND produto_id = v_variant.produto_id
      AND (produto_variante_id = v_variant.id OR produto_variante_id IS NULL);

    UPDATE public.ordens_compra
    SET variacao_selecionada = v_snapshot,
        produto_variante_id = v_variant.id
    WHERE orcamento_id = v_order_id AND produto_id = v_variant.produto_id
      AND (produto_variante_id = v_variant.id OR produto_variante_id IS NULL);

    IF v_variant.controle_estoque AND v_requested > 0 THEN
      UPDATE public.produto_variantes
      SET estoque_disponivel = estoque_disponivel - v_requested
      WHERE id = v_variant.id;
    END IF;
  END LOOP;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_client_checkout_store(uuid, text, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.gsa_client_checkout_store(uuid, text, jsonb) TO authenticated, service_role;

COMMENT ON TABLE public.produto_variacao_grupos IS 'Atributos variaveis do produto, como Cor, Tamanho e Numero.';
COMMENT ON TABLE public.produto_variacao_opcoes IS 'Valores disponiveis para cada atributo de variacao.';
COMMENT ON TABLE public.produto_variantes IS 'Combinacoes compraveis com preco, SKU, imagem e estoque proprios.';
COMMENT ON COLUMN public.loja_pedido_itens.variacao_selecionada IS 'Snapshot imutavel da combinacao escolhida no checkout.';
