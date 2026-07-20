-- 20260715180000_secure_admin_batch_product_import.sql

-- Helper function to normalize URLs purely at DB level for comparison
CREATE OR REPLACE FUNCTION gsa_normalize_url(p_url text)
RETURNS text AS $$
DECLARE
  v_normalized text;
BEGIN
  IF p_url IS NULL OR p_url = '' THEN
    RETURN NULL;
  END IF;

  -- basic lowercasing and trimming
  v_normalized := lower(trim(p_url));
  
  -- remove protocol for easier matching
  v_normalized := regexp_replace(v_normalized, '^https?:\/\/(www\.)?', '');
  
  -- remove fragment
  v_normalized := split_part(v_normalized, '#', 1);
  
  -- remove trailing slashes
  v_normalized := regexp_replace(v_normalized, '\/+$', '');
  
  RETURN v_normalized;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- RPC 1: Check existing products
CREATE OR REPLACE FUNCTION gsa_admin_check_existing_supplier_products(
    p_sessao_id uuid,
    p_session_token text,
    p_urls text[]
)
RETURNS TABLE (
    url_normalizada text,
    produto_id uuid,
    codigo_produto text,
    nome_produto text,
    status text
) AS $$
DECLARE
    v_ator_id uuid;
    v_ator_tipo text;
    v_url text;
    v_url_norm text;
BEGIN
    -- Validate session and permissions
    SELECT ator_id, ator_tipo INTO v_ator_id, v_ator_tipo 
    FROM gsa_admin_session_actor(p_sessao_id, p_session_token);

    IF v_ator_id IS NULL THEN
        RAISE EXCEPTION 'Sessão inválida ou sem permissão para acessar produtos.';
    END IF;

    -- Return matches
    RETURN QUERY
    WITH normalized_input AS (
        SELECT unnest(p_urls) AS raw_url, gsa_normalize_url(unnest(p_urls)) AS norm_url
    )
    SELECT 
        ni.norm_url AS url_normalizada,
        p.id AS produto_id,
        p.codigo_produto,
        p.nome AS nome_produto,
        p.status
    FROM normalized_input ni
    JOIN produto_fornecedor_config pfc ON gsa_normalize_url(pfc.url_produto) = ni.norm_url
    JOIN produtos p ON p.id = pfc.produto_id
    WHERE pfc.tipo_fornecedor = 'online' AND pfc.url_produto IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION gsa_admin_check_existing_supplier_products(uuid, text, text[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION gsa_admin_check_existing_supplier_products(uuid, text, text[]) TO authenticated, service_role;


-- RPC 2: Batch import products
CREATE OR REPLACE FUNCTION gsa_admin_import_products_batch(
    p_sessao_id uuid,
    p_session_token text,
    p_items jsonb
)
RETURNS jsonb AS $$
DECLARE
    v_ator_id uuid;
    v_ator_tipo text;
    v_ator_nome text;
    
    v_item jsonb;
    v_client_id text;
    v_nome text;
    v_descricao text;
    v_valor_custo numeric;
    v_porcentagem_lucro numeric;
    v_valor_final numeric;
    v_tipo_cliente text;
    v_categoria_id uuid;
    v_ocultar_valor boolean;
    v_visivel_na_loja boolean;
    v_controle_estoque boolean;
    v_estoque_disponivel numeric;
    v_imagens jsonb;
    v_fornecedor_config jsonb;
    v_url_produto text;
    v_force_duplicate boolean;
    
    v_produto_id uuid;
    v_codigo_produto text;
    v_is_duplicate boolean;
    v_url_norm text;
    
    v_created jsonb[] := ARRAY[]::jsonb[];
    v_skipped jsonb[] := ARRAY[]::jsonb[];
    v_failed jsonb[] := ARRAY[]::jsonb[];
    
    v_images_array text[];
    v_img_1 text; v_img_2 text; v_img_3 text; v_img_4 text; v_img_5 text;
    
    v_idx int;
BEGIN
    -- Validate session
    SELECT ator_id, ator_tipo, ator_nome INTO v_ator_id, v_ator_tipo, v_ator_nome 
    FROM gsa_admin_session_actor(p_sessao_id, p_session_token);

    IF v_ator_id IS NULL THEN
        RAISE EXCEPTION 'Sessão inválida ou sem permissão para acessar produtos.';
    END IF;

    IF jsonb_typeof(p_items) != 'array' THEN
        RAISE EXCEPTION 'p_items deve ser um array JSON';
    END IF;

    IF jsonb_array_length(p_items) > 50 THEN
        RAISE EXCEPTION 'Limite máximo de 50 produtos por lote excedido.';
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        BEGIN
            v_client_id := v_item->>'client_id';
            v_nome := v_item->>'nome';
            v_descricao := v_item->>'descricao';
            v_valor_custo := (v_item->>'valor_custo')::numeric;
            v_porcentagem_lucro := (v_item->>'porcentagem_lucro')::numeric;
            v_tipo_cliente := COALESCE(v_item->>'tipo_cliente', 'todos');
            v_categoria_id := (v_item->>'categoria_id')::uuid;
            v_ocultar_valor := COALESCE((v_item->>'ocultar_valor')::boolean, false);
            v_visivel_na_loja := COALESCE((v_item->>'visivel_na_loja')::boolean, false);
            v_controle_estoque := COALESCE((v_item->>'controle_estoque')::boolean, false);
            v_estoque_disponivel := COALESCE((v_item->>'estoque_disponivel')::numeric, 0);
            v_imagens := v_item->'imagens';
            v_fornecedor_config := v_item->'fornecedor_config';
            v_url_produto := v_fornecedor_config->>'url_produto';
            v_force_duplicate := COALESCE((v_item->>'force_duplicate')::boolean, false);

            -- Validations
            IF v_nome IS NULL OR v_nome = '' THEN
                RAISE EXCEPTION 'Nome é obrigatório';
            END IF;
            IF v_valor_custo IS NULL OR v_valor_custo < 0 THEN
                RAISE EXCEPTION 'Valor de custo inválido';
            END IF;
            IF v_url_produto IS NULL OR v_url_produto = '' THEN
                RAISE EXCEPTION 'URL do fornecedor é obrigatória';
            END IF;

            -- Check duplication
            IF NOT v_force_duplicate THEN
                v_url_norm := gsa_normalize_url(v_url_produto);
                SELECT TRUE INTO v_is_duplicate
                FROM produto_fornecedor_config 
                WHERE gsa_normalize_url(url_produto) = v_url_norm 
                  AND tipo_fornecedor = 'online' LIMIT 1;
                  
                IF v_is_duplicate THEN
                    v_skipped := array_append(v_skipped, jsonb_build_object(
                        'client_id', v_client_id,
                        'nome', v_nome,
                        'status', 'ignorado',
                        'motivo', 'Produto já cadastrado com esta URL'
                    ));
                    CONTINUE;
                END IF;
            END IF;

            -- Calculate final price
            v_valor_final := v_valor_custo * (1 + (v_porcentagem_lucro / 100));

            -- Parse images
            v_images_array := ARRAY(SELECT jsonb_array_elements_text(v_imagens));
            v_img_1 := v_images_array[1];
            v_img_2 := v_images_array[2];
            v_img_3 := v_images_array[3];
            v_img_4 := v_images_array[4];
            v_img_5 := v_images_array[5];

            -- Generate unique PRD code (using timestamp and random padding to avoid collision in tight loops)
            v_codigo_produto := 'PRD' || lpad(floor(random() * 1000000)::text, 6, '0') || to_char(clock_timestamp(), 'MS');

            -- Insert Product
            INSERT INTO produtos (
                codigo_produto, nome, descricao, valor, valor_custo,
                porcentagem_lucro, tipo_cliente, categoria_id, ocultar_valor,
                visivel_na_loja, controle_estoque, estoque_disponivel, status,
                imagem_url, imagem_url_2, imagem_url_3, imagem_url_4, imagem_url_5
            ) VALUES (
                v_codigo_produto, v_nome, v_descricao, v_valor_final, v_valor_custo,
                v_porcentagem_lucro, v_tipo_cliente, v_categoria_id, v_ocultar_valor,
                v_visivel_na_loja, v_controle_estoque, v_estoque_disponivel, 'ativo',
                v_img_1, v_img_2, v_img_3, v_img_4, v_img_5
            ) RETURNING id INTO v_produto_id;

            -- Insert Supplier Config
            INSERT INTO produto_fornecedor_config (
                produto_id,
                fornecimento_externo_ativo,
                tipo_fornecedor,
                url_produto,
                nome_fornecedor,
                telefone_fornecedor,
                observacoes_internas
            ) VALUES (
                v_produto_id,
                true,
                'online',
                v_url_produto,
                v_fornecedor_config->>'nome_fornecedor',
                v_fornecedor_config->>'telefone',
                v_fornecedor_config->>'observacoes'
            );

            v_created := array_append(v_created, jsonb_build_object(
                'client_id', v_client_id,
                'produto_id', v_produto_id,
                'codigo_produto', v_codigo_produto,
                'nome', v_nome,
                'status', 'criado'
            ));

        EXCEPTION WHEN OTHERS THEN
            v_failed := array_append(v_failed, jsonb_build_object(
                'client_id', v_client_id,
                'nome', v_nome,
                'status', 'erro',
                'motivo', SQLERRM
            ));
        END;
    END LOOP;

    -- Audit log
    IF array_length(v_created, 1) > 0 THEN
        INSERT INTO sistema_logs (acao, ator_tipo, ator_id, ator_nome, detalhes)
        VALUES (
            'IMPORTAR_PRODUTOS_EM_LOTE',
            v_ator_tipo,
            v_ator_id,
            v_ator_nome,
            jsonb_build_object(
                'lote_tamanho', jsonb_array_length(p_items),
                'criados', array_length(v_created, 1),
                'ignorados', array_length(v_skipped, 1),
                'falhas', array_length(v_failed, 1)
            )::text
        );
    END IF;

    RETURN jsonb_build_object(
        'created', to_jsonb(v_created),
        'skipped', to_jsonb(v_skipped),
        'failed', to_jsonb(v_failed)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION gsa_admin_import_products_batch(uuid, text, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION gsa_admin_import_products_batch(uuid, text, jsonb) TO authenticated, service_role;
