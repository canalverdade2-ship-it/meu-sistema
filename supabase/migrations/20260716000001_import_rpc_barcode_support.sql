CREATE OR REPLACE FUNCTION public.gsa_admin_import_products_batch_v2(p_sessao_id uuid, p_session_token text, p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_ator_id uuid;
    v_ator_tipo text;
    v_ator_nome text;
    
    v_item jsonb;
    v_client_id text;
    v_source_type text;
    v_source_fingerprint text;
    v_source_reference text;
    v_supplier_mode text;
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
    
    v_codigo_barras text;
    v_tipo_codigo_barras text;
    v_identificador_preferencial text;

    v_produto_id uuid;
    v_codigo_produto text;
    v_is_duplicate boolean;
    v_url_norm text;
    
    v_created jsonb[] := ARRAY[]::jsonb[];
    v_skipped jsonb[] := ARRAY[]::jsonb[];
    v_failed jsonb[] := ARRAY[]::jsonb[];
    
    v_images_array text[];
    v_img_1 text; v_img_2 text; v_img_3 text; v_img_4 text; v_img_5 text;
    
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
            v_source_type := COALESCE(v_item->>'source_type', 'url');
            v_source_fingerprint := v_item->>'source_fingerprint';
            v_source_reference := v_item->>'source_reference';
            v_supplier_mode := COALESCE(v_item->>'supplier_mode', 'online');
            
            v_nome := v_item->>'nome';
            v_descricao := v_item->>'descricao';
            v_valor_custo := (v_item->>'valor_custo')::numeric;
            v_porcentagem_lucro := COALESCE((v_item->>'porcentagem_lucro')::numeric, 0);
            v_tipo_cliente := COALESCE(v_item->>'tipo_cliente', 'ambos');
            v_categoria_id := NULLIF(v_item->>'categoria_id', '')::uuid;
            v_ocultar_valor := COALESCE((v_item->>'ocultar_valor')::boolean, false);
            v_visivel_na_loja := COALESCE((v_item->>'visivel_na_loja')::boolean, false);
            v_controle_estoque := COALESCE((v_item->>'controle_estoque')::boolean, false);
            v_estoque_disponivel := COALESCE((v_item->>'estoque_disponivel')::numeric, 0);
            v_imagens := COALESCE(v_item->'imagens', '[]'::jsonb);
            v_fornecedor_config := COALESCE(v_item->'fornecedor_config', '{}'::jsonb);
            v_force_duplicate := COALESCE((v_item->>'force_duplicate')::boolean, false);

            v_codigo_barras := NULLIF(trim(v_item->>'codigo_barras'), '');
            v_tipo_codigo_barras := NULLIF(v_item->>'tipo_codigo_barras', '');
            v_identificador_preferencial := COALESCE(v_item->>'identificador_preferencial', 'interno');

            -- Extract config fields
            v_url_produto := v_fornecedor_config->>'url_produto';

            -- Validations
            IF v_nome IS NULL OR v_nome = '' THEN
                RAISE EXCEPTION 'Nome é obrigatório';
            END IF;
            IF v_valor_custo IS NULL OR v_valor_custo < 0 THEN
                RAISE EXCEPTION 'Valor de custo inválido';
            END IF;

            IF v_supplier_mode = 'online' THEN
                IF v_url_produto IS NULL OR v_url_produto = '' THEN
                    RAISE EXCEPTION 'URL do fornecedor é obrigatória no modo online';
                END IF;
            ELSIF v_supplier_mode = 'loja_fisica' THEN
                IF (v_fornecedor_config->>'nome_fornecedor') IS NULL OR (v_fornecedor_config->>'nome_fornecedor') = '' THEN
                    RAISE EXCEPTION 'Nome do fornecedor é obrigatório no modo loja física';
                END IF;
                IF (v_fornecedor_config->>'cidade') IS NULL OR (v_fornecedor_config->>'cidade') = '' THEN
                    RAISE EXCEPTION 'Cidade do fornecedor é obrigatória no modo loja física';
                END IF;
                IF (v_fornecedor_config->>'telefone') IS NULL OR (v_fornecedor_config->>'telefone') = '' THEN
                    RAISE EXCEPTION 'Telefone do fornecedor é obrigatório no modo loja física';
                END IF;
            END IF;

            -- Check duplication by Barcode
            IF v_codigo_barras IS NOT NULL THEN
                SELECT TRUE INTO v_is_duplicate
                FROM produtos
                WHERE codigo_barras = v_codigo_barras LIMIT 1;

                IF v_is_duplicate THEN
                    -- Barcodes cannot be force duplicated
                    v_skipped := array_append(v_skipped, jsonb_build_object(
                        'client_id', v_client_id,
                        'nome', v_nome,
                        'status', 'ignorado',
                        'motivo', 'Código de barras já cadastrado'
                    ));
                    CONTINUE;
                END IF;
            END IF;

            -- Check duplication by Fingerprint
            IF NOT v_force_duplicate AND v_source_fingerprint IS NOT NULL AND v_source_fingerprint != '' THEN
                SELECT TRUE INTO v_is_duplicate
                FROM produto_importacao_origem 
                WHERE source_fingerprint = v_source_fingerprint LIMIT 1;
                
                IF v_is_duplicate THEN
                    v_skipped := array_append(v_skipped, jsonb_build_object(
                        'client_id', v_client_id,
                        'nome', v_nome,
                        'status', 'ignorado',
                        'motivo', 'Produto já importado anteriormente com esta origem'
                    ));
                    CONTINUE;
                END IF;
            END IF;

            -- Check duplication by URL (only online)
            IF NOT v_force_duplicate AND v_supplier_mode = 'online' AND v_url_produto IS NOT NULL THEN
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

            -- Insert Product
            INSERT INTO produtos (
                nome, descricao, valor, valor_custo,
                porcentagem_lucro, tipo_cliente, categoria_id, ocultar_valor,
                visivel_na_loja, controle_estoque, estoque_disponivel, status,
                imagem_url, imagem_url_2, imagem_url_3, imagem_url_4, imagem_url_5,
                codigo_barras, tipo_codigo_barras, identificador_preferencial
            ) VALUES (
                v_nome, v_descricao, v_valor_final, v_valor_custo,
                v_porcentagem_lucro, v_tipo_cliente, v_categoria_id, v_ocultar_valor,
                v_visivel_na_loja, v_controle_estoque, v_estoque_disponivel, 'ativo',
                v_img_1, v_img_2, v_img_3, v_img_4, v_img_5,
                v_codigo_barras, v_tipo_codigo_barras, v_identificador_preferencial
            ) RETURNING id, codigo_produto INTO v_produto_id, v_codigo_produto;

            -- Insert Supplier Config
            IF v_supplier_mode = 'online' THEN
                INSERT INTO produto_fornecedor_config (
                    produto_id, fornecimento_externo_ativo, tipo_fornecedor,
                    url_produto, nome_fornecedor, telefone, observacoes
                ) VALUES (
                    v_produto_id, true, 'online', v_url_produto,
                    v_fornecedor_config->>'nome_fornecedor',
                    v_fornecedor_config->>'telefone',
                    v_fornecedor_config->>'observacoes'
                );
            ELSIF v_supplier_mode = 'loja_fisica' THEN
                INSERT INTO produto_fornecedor_config (
                    produto_id, fornecimento_externo_ativo, tipo_fornecedor,
                    nome_fornecedor, cidade, estado, endereco, telefone, observacoes
                ) VALUES (
                    v_produto_id, true, 'loja_fisica',
                    v_fornecedor_config->>'nome_fornecedor',
                    v_fornecedor_config->>'cidade',
                    v_fornecedor_config->>'estado',
                    v_fornecedor_config->>'endereco',
                    v_fornecedor_config->>'telefone',
                    v_fornecedor_config->>'observacoes'
                );
            END IF;

            -- Save origin mapping
            IF v_source_fingerprint IS NOT NULL AND v_source_fingerprint != '' THEN
                INSERT INTO produto_importacao_origem (
                    produto_id, source_type, source_fingerprint, source_reference,
                    imported_by_type, imported_by_id, imported_by_name
                ) VALUES (
                    v_produto_id, v_source_type, v_source_fingerprint, v_source_reference,
                    v_ator_tipo, v_ator_id, v_ator_nome
                );
            END IF;

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

    -- Audit log Always
    INSERT INTO sistema_logs (acao, ator_tipo, ator_id, ator_nome, detalhes)
    VALUES (
        'IMPORTAR_PRODUTOS_EM_LOTE',
        v_ator_tipo,
        v_ator_id,
        v_ator_nome,
        jsonb_build_object(
            'lote_tamanho', jsonb_array_length(p_items),
            'criados', COALESCE(array_length(v_created, 1), 0),
            'ignorados', COALESCE(array_length(v_skipped, 1), 0),
            'falhas', COALESCE(array_length(v_failed, 1), 0),
            'falhas_detalhes', v_failed
        )::text
    );

    RETURN jsonb_build_object(
        'created', COALESCE(to_jsonb(v_created), '[]'::jsonb),
        'skipped', COALESCE(to_jsonb(v_skipped), '[]'::jsonb),
        'failed', COALESCE(to_jsonb(v_failed), '[]'::jsonb)
    );
END;
$function$
