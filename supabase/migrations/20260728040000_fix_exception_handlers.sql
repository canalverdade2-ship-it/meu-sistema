-- File: 20260317000002_auto_level_upgrade.sql
-- Function: fn_processar_upgrade_nivel_automatico
CREATE OR REPLACE FUNCTION fn_processar_upgrade_nivel_automatico()
RETURNS TRIGGER AS $$
DECLARE
    v_new_status TEXT;
    v_old_status TEXT;
    v_tipo TEXT;
    v_pacote_nivel_id UUID;
    v_cliente_id UUID;
    v_nivel_anterior_id UUID;
    v_nivel_nome TEXT;
BEGIN
    v_new_status := NEW.status;
    v_old_status := OLD.status;
    v_tipo := NEW.tipo;
    v_cliente_id := NEW.cliente_id;

    -- Só processa se o status mudou para 'pago' e é uma fatura de pacote_nivel
    IF (v_new_status = 'pago' AND v_old_status IS DISTINCT FROM 'pago' AND v_tipo = 'pacote_nivel' AND NEW.pacote_nivel_id IS NOT NULL) THEN
        
        -- Tenta converter o pacote_nivel_id para UUID. Se falhar (for texto como 'bronze'), busca pelo nome
        BEGIN
            v_pacote_nivel_id := NEW.pacote_nivel_id::UUID;
        EXCEPTION WHEN OTHERS THEN
            -- Se falhar a conversão, busca o ID do nível pelo nome (capitalizando a primeira letra)
            SELECT id INTO v_pacote_nivel_id 
            FROM client_levels 
            WHERE LOWER(nome_nivel) = LOWER(NEW.pacote_nivel_id::TEXT)
            LIMIT 1;
        END;

        IF v_pacote_nivel_id IS NOT NULL THEN
            -- Pega o nível atual do cliente para o histórico
            SELECT nivel_id INTO v_nivel_anterior_id FROM clientes WHERE id = v_cliente_id;
            
            -- Pega o nome real do novo nível para a notificação
            SELECT nome_nivel INTO v_nivel_nome FROM client_levels WHERE id = v_pacote_nivel_id;

            -- 1. Atualiza o nível do cliente
            UPDATE clientes 
            SET nivel_id = v_pacote_nivel_id,
                nivel_manual_id = NULL,
                nivel_manual_info = NULL
            WHERE id = v_cliente_id;

            -- 2. Registra no histórico de níveis
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'level_history') THEN
                INSERT INTO level_history (cliente_id, nivel_anterior_id, nivel_novo_id)
                VALUES (v_cliente_id, v_nivel_anterior_id, v_pacote_nivel_id);
            END IF;

-- File: 20260714051000_secure_atomic_login_sessions.sql
-- Function: gsa_request_ip
CREATE OR REPLACE FUNCTION public.gsa_request_ip()
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_headers jsonb;
BEGIN
  BEGIN
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Falha em operação opcional (gsa_request_ip): %', SQLERRM;
            v_headers := '{}'::jsonb;
        END;

  RETURN coalesce(
    nullif(split_part(v_headers ->> 'x-forwarded-for', ',', 1), ''),
    nullif(v_headers ->> 'cf-connecting-ip', ''),
    nullif(v_headers ->> 'x-real-ip', ''),
    'unknown'
  );
END;
$$;

-- File: 20260715212051_universal_product_import.sql
-- Function: gsa_admin_import_products_batch_v2
CREATE OR REPLACE FUNCTION public.gsa_admin_import_products_batch_v2(
  p_sessao_id uuid,
  p_session_token text,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
            v_tipo_cliente := COALESCE(v_item->>'tipo_cliente', 'todos');
            v_categoria_id := NULLIF(v_item->>'categoria_id', '')::uuid;
            v_ocultar_valor := COALESCE((v_item->>'ocultar_valor')::boolean, false);
            v_visivel_na_loja := COALESCE((v_item->>'visivel_na_loja')::boolean, false);
            v_controle_estoque := COALESCE((v_item->>'controle_estoque')::boolean, false);
            v_estoque_disponivel := COALESCE((v_item->>'estoque_disponivel')::numeric, 0);
            v_imagens := COALESCE(v_item->'imagens', '[]'::jsonb);
            v_fornecedor_config := COALESCE(v_item->'fornecedor_config', '{}'::jsonb);
            v_force_duplicate := COALESCE((v_item->>'force_duplicate')::boolean, false);

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

            -- Generate unique PRD code
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
            RAISE EXCEPTION 'Erro em gsa_admin_import_products_batch_v2: %', SQLERRM;
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
                'criados', COALESCE(array_length(v_created, 1), 0),
                'ignorados', COALESCE(array_length(v_skipped, 1), 0),
                'falhas', COALESCE(array_length(v_failed, 1), 0)
            )::text
        );
    END IF;

    RETURN jsonb_build_object(
        'created', COALESCE(to_jsonb(v_created), '[]'::jsonb),
        'skipped', COALESCE(to_jsonb(v_skipped), '[]'::jsonb),
        'failed', COALESCE(to_jsonb(v_failed), '[]'::jsonb)
    );
END;
$$;

-- File: 20260718121000_gsa_seguros_complete.sql
-- Function: gsa_client_seguros_criar_cotacao
CREATE OR REPLACE FUNCTION public.gsa_client_seguros_criar_cotacao(p_sessao_id uuid,p_session_token text,p_payload jsonb,p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_cliente uuid;v_id uuid;v_protocolo text;v_valor numeric;v_produto uuid;
BEGIN
 SELECT ator_id INTO v_cliente FROM gsa_validate_session(p_sessao_id,p_session_token) WHERE is_valid AND ator_tipo='cliente' LIMIT 1;
 IF v_cliente IS NULL THEN RAISE EXCEPTION 'Sessão de cliente inválida ou expirada.'; END IF;
 IF coalesce(p_payload->>'categoria','')='' OR coalesce(p_payload->>'consentimento','')<>'sim' THEN RAISE EXCEPTION 'Categoria e consentimento são obrigatórios.'; END IF;
 SELECT id,protocolo INTO v_id,v_protocolo FROM seguros_cotacoes WHERE cliente_id=v_cliente AND idempotency_key=p_idempotency_key;
 IF v_id IS NOT NULL THEN RETURN jsonb_build_object('success',true,'id',v_id,'protocolo',v_protocolo,'idempotent',true); END IF;
 BEGIN v_valor:=nullif(regexp_replace(coalesce(p_payload->>'valor_risco',''),'[^0-9,.]','','g'),'')::numeric; EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'Erro em gsa_client_seguros_criar_cotacao: %', SQLERRM;
        END;
 v_protocolo:='SEG-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
 SELECT id INTO v_produto FROM seguros_produtos WHERE id::text=coalesce(p_payload->>'oferta_id','') OR slug=coalesce(p_payload->>'oferta_slug','') LIMIT 1;
 INSERT INTO seguros_cotacoes(cliente_id,produto_id,protocolo,categoria,localidade,inicio_desejado,objeto_segurado,valor_risco,dados,idempotency_key)
 VALUES(v_cliente,v_produto,v_protocolo,p_payload->>'categoria',p_payload->>'localidade',nullif(p_payload->>'inicio_desejado','')::date,p_payload->>'objeto_segurado',v_valor,p_payload,p_idempotency_key) RETURNING id INTO v_id;
 INSERT INTO seguros_auditoria(ator_tipo,ator_id,acao,entidade,entidade_id) VALUES('cliente',v_cliente,'criar_cotacao','seguros_cotacoes',v_id);
 RETURN jsonb_build_object('success',true,'id',v_id,'protocolo',v_protocolo);
END $$;

-- File: 20260720140000_gsa_viagens_hardening.sql
-- Function: gsa_travel_safe_nonnegative_int
CREATE OR REPLACE FUNCTION public.gsa_travel_safe_nonnegative_int(p_value TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_value IS NULL OR p_value !~ '^\d+$' THEN
    RETURN 0;
  END IF;

  RETURN LEAST(p_value::INTEGER, 100);
EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'Erro em gsa_travel_safe_nonnegative_int: %', SQLERRM;
        END;
$$;

-- File: 20260720201000_schedule_and_guard_store_credit_release.sql
-- Function: gsa_process_due_store_credit_releases
CREATE OR REPLACE FUNCTION public.gsa_process_due_store_credit_releases()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_solicitacao public.loja_credito_solicitacoes%ROWTYPE;
  v_cliente public.clientes%ROWTYPE;
  v_limite_aprovado NUMERIC;
  v_total_anterior NUMERIC;
  v_disponivel_anterior NUMERIC;
  v_total_novo NUMERIC;
  v_disponivel_novo NUMERIC;
  v_variacao NUMERIC;
  v_tipo_mov TEXT;
  v_processadas INTEGER := 0;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('gsa_process_due_store_credit_releases')) THEN
    RETURN 0;
  END IF;

  PERFORM set_config('gsa.credit_release', 'on', true);

  FOR v_solicitacao IN
    SELECT *
    FROM public.loja_credito_solicitacoes
    WHERE status = 'contrato_assinado'
      AND data_liberacao_credito IS NOT NULL
      AND data_liberacao_credito <= CURRENT_DATE
    ORDER BY data_liberacao_credito, created_at, id
    FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      SELECT *
        INTO v_cliente
      FROM public.clientes
      WHERE id = v_solicitacao.cliente_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Cliente % não encontrado.', v_solicitacao.cliente_id;
      END IF;

      IF COALESCE(v_cliente.bloqueado, false)
         OR v_cliente.status IS DISTINCT FROM 'ativo'
         OR COALESCE(v_cliente.cadastro_aprovado, false) = false THEN
        RAISE EXCEPTION 'Cliente % sem acesso ativo.', v_cliente.id;
      END IF;

      v_limite_aprovado := COALESCE(v_solicitacao.limite_aprovado, 0);
      IF v_limite_aprovado <= 0 THEN
        RAISE EXCEPTION 'Solicitação % possui limite inválido.', v_solicitacao.id;
      END IF;

      v_total_anterior := COALESCE(v_cliente.limite_credito_total, 0);
      v_disponivel_anterior := COALESCE(v_cliente.limite_credito_disponivel, 0);

      IF v_solicitacao.tipo_solicitacao = 'adesao' THEN
        v_total_novo := v_limite_aprovado;
        v_disponivel_novo := v_limite_aprovado;
        v_variacao := v_limite_aprovado;
        v_tipo_mov := 'concessao_inicial';
      ELSE
        v_variacao := v_limite_aprovado - v_total_anterior;
        v_total_novo := v_limite_aprovado;
        v_disponivel_novo := v_disponivel_anterior + v_variacao;
        v_tipo_mov := 'solicitacao_aumento_aprovada';

        IF v_disponivel_novo < 0 THEN
          RAISE EXCEPTION 'Novo limite inferior ao crédito utilizado pelo cliente %.', v_cliente.id;
        END IF;
      END IF;

      UPDATE public.clientes
      SET limite_credito_total = v_total_novo,
          limite_credito_disponivel = v_disponivel_novo,
          opcao_pagamento_parcelado = v_solicitacao.opcao_pagamento_parcelado
      WHERE id = v_cliente.id;

      INSERT INTO public.loja_credito_movimentacoes (
        cliente_id,
        solicitacao_id,
        tipo,
        valor,
        limite_total_anterior,
        limite_total_novo,
        limite_disponivel_anterior,
        limite_disponivel_novo,
        descricao
      )
      SELECT
        v_cliente.id,
        v_solicitacao.id,
        v_tipo_mov,
        v_variacao,
        v_total_anterior,
        v_total_novo,
        v_disponivel_anterior,
        v_disponivel_novo,
        CASE
          WHEN v_solicitacao.tipo_solicitacao = 'adesao'
            THEN 'Ativação automática e transacional de limite aprovado'
          ELSE format('Ajuste automático e transacional do limite para %s', v_limite_aprovado)
        END
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.loja_credito_movimentacoes existente
        WHERE existente.solicitacao_id = v_solicitacao.id
          AND existente.tipo IN ('concessao_inicial', 'solicitacao_aumento_aprovada')
      );

      UPDATE public.loja_credito_solicitacoes
      SET status = 'liberado',
          updated_at = NOW()
      WHERE id = v_solicitacao.id
        AND status = 'contrato_assinado';

      IF FOUND THEN
        INSERT INTO public.notificacoes (
          cliente_id,
          destinatario_tipo,
          titulo,
          mensagem,
          modulo,
          tipo,
          lida,
          data_criacao
        ) VALUES (
          v_cliente.id,
          'cliente',
          'Crédito ativo',
          format(
            'Seu limite de crédito de R$ %s foi liberado e já está disponível.',
            to_char(v_limite_aprovado, 'FM999G999G990D00')
          ),
          'credito_loja',
          'sistema',
          false,
          NOW()
        );
        v_processadas := v_processadas + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Falha ao liberar solicitação de crédito %: %', v_solicitacao.id, SQLERRM;
            RAISE EXCEPTION 'Erro em gsa_process_due_store_credit_releases: %', SQLERRM;
        END;
  END LOOP;

  RETURN v_processadas;
END;
$$;

-- File: 20260720205000_optional_client_block_state_compat.sql
-- Function: gsa_process_due_store_credit_releases
CREATE OR REPLACE FUNCTION public.gsa_process_due_store_credit_releases()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_cliente_id UUID;
  v_total INTEGER := 0;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('gsa_process_due_store_credit_releases')) THEN
    RETURN 0;
  END IF;

  FOR v_cliente_id IN
    SELECT DISTINCT cliente_id
    FROM public.loja_credito_solicitacoes
    WHERE status = 'contrato_assinado'
      AND data_liberacao_credito IS NOT NULL
      AND data_liberacao_credito <= CURRENT_DATE
      AND cliente_id IS NOT NULL
  LOOP
    BEGIN
      v_total := v_total + public.gsa_release_due_store_credit_for_client(v_cliente_id);
    EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Falha ao processar crédito do cliente %: %', v_cliente_id, SQLERRM;
            RAISE EXCEPTION 'Erro em gsa_process_due_store_credit_releases: %', SQLERRM;
        END;
  END LOOP;

  RETURN v_total;
END;
$$;

-- File: 20260720232000_secure_public_sites_systems_budget.sql
-- Function: gsa_public_create_enterprise_budget_v2
CREATE OR REPLACE FUNCTION public.gsa_public_create_enterprise_budget_v2(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_name text;
  v_email text;
  v_phone text;
  v_type text;
  v_request text;
  v_honeypot text;
  v_started_at timestamptz;
  v_now timestamptz := clock_timestamp();
  v_fingerprint text;
  v_protocol text;
  v_rate public.gsa_public_budget_rate_limits%ROWTYPE;
  v_metadata jsonb;
  v_sanitized jsonb;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'Dados da solicitação inválidos.' USING ERRCODE = '22023';
  END IF;

  v_name := btrim(COALESCE(p_payload->>'nome', ''));
  v_email := lower(btrim(COALESCE(p_payload->>'email', '')));
  v_phone := regexp_replace(COALESCE(p_payload->>'telefone', ''), '\D', '', 'g');
  v_type := lower(btrim(COALESCE(p_payload->>'tipo', '')));
  v_request := btrim(COALESCE(p_payload->>'solicitacao', ''));
  v_honeypot := btrim(COALESCE(p_payload->>'website', ''));
  v_metadata := CASE
    WHEN jsonb_typeof(p_payload->'metadata') = 'object' THEN p_payload->'metadata'
    ELSE '{}'::jsonb
  END;

  v_protocol := 'GSA-' || to_char(v_now AT TIME ZONE 'America/Sao_Paulo', 'YYYYMMDD') || '-' ||
    upper(substr(md5(random()::text || v_now::text), 1, 6));

  -- Robôs que preenchem o campo invisível recebem resposta neutra, sem gravar lead.
  IF v_honeypot <> '' THEN
    RETURN jsonb_build_object('success', true, 'protocol', v_protocol);
  END IF;

  IF char_length(v_name) < 2 OR char_length(v_name) > 120 THEN
    RAISE EXCEPTION 'Nome inválido.' USING ERRCODE = '22023';
  END IF;

  IF char_length(v_email) > 160 OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'E-mail inválido.' USING ERRCODE = '22023';
  END IF;

  IF char_length(v_phone) NOT BETWEEN 10 AND 11 THEN
    RAISE EXCEPTION 'Telefone inválido.' USING ERRCODE = '22023';
  END IF;

  IF v_type NOT IN ('site', 'loja', 'sistema', 'aplicativo', 'automacao', 'integracao') THEN
    RAISE EXCEPTION 'Tipo de projeto inválido.' USING ERRCODE = '22023';
  END IF;

  IF char_length(v_request) < 20 OR char_length(v_request) > 2000 THEN
    RAISE EXCEPTION 'Descrição inválida.' USING ERRCODE = '22023';
  END IF;

  BEGIN
    v_started_at := (p_payload->>'started_at')::timestamptz;
  EXCEPTION WHEN OTHERS THEN
            RAISE
            RAISE EXCEPTION 'Erro em gsa_public_create_enterprise_budget_v2: %', SQLERRM;
        EXCEPTION 'Tempo de preenchimento inválido.' USING ERRCODE = '22023';
  END;

  IF v_started_at > v_now
     OR v_now - v_started_at < interval '2 seconds'
     OR v_now - v_started_at > interval '2 hours' THEN
    RAISE EXCEPTION 'Tempo de preenchimento inválido.' USING ERRCODE = '22023';
  END IF;

  -- O limite usa contato normalizado. Não depende de dados fornecidos como identificador livre.
  v_fingerprint := md5(v_email || ':' || v_phone);

  INSERT INTO public.gsa_public_budget_rate_limits (fingerprint, window_started_at, attempts, updated_at)
  VALUES (v_fingerprint, v_now, 0, v_now)
  ON CONFLICT (fingerprint) DO NOTHING;

  SELECT *
    INTO v_rate
    FROM public.gsa_public_budget_rate_limits
   WHERE fingerprint = v_fingerprint
   FOR UPDATE;

  IF v_rate.blocked_until IS NOT NULL AND v_rate.blocked_until > v_now THEN
    RAISE EXCEPTION 'Limite temporário de solicitações atingido.' USING ERRCODE = 'P0001';
  END IF;

  IF v_rate.window_started_at < v_now - interval '1 hour' THEN
    UPDATE public.gsa_public_budget_rate_limits
       SET window_started_at = v_now,
           attempts = 0,
           blocked_until = NULL,
           updated_at = v_now
     WHERE fingerprint = v_fingerprint;
    v_rate.attempts := 0;
  END IF;

  IF v_rate.attempts >= 4 THEN
    UPDATE public.gsa_public_budget_rate_limits
       SET blocked_until = v_now + interval '2 hours',
           updated_at = v_now
     WHERE fingerprint = v_fingerprint;
    RAISE EXCEPTION 'Limite temporário de solicitações atingido.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.gsa_public_budget_rate_limits
     SET attempts = attempts + 1,
         updated_at = v_now
   WHERE fingerprint = v_fingerprint;

  v_sanitized := jsonb_build_object(
    'nome', v_name,
    'email', v_email,
    'telefone', v_phone,
    'tipo', v_type,
    'solicitacao', v_request,
    'protocolo', v_protocol,
    'origem', 'public_sites_systems',
    'data_envio', v_now,
    'metadata', jsonb_build_object(
      'source', left(COALESCE(v_metadata->>'source', 'public_sites_systems'), 80),
      'page', left(COALESCE(v_metadata->>'page', ''), 300),
      'referrer', left(COALESCE(v_metadata->>'referrer', ''), 500),
      'utm_source', left(COALESCE(v_metadata->>'utm_source', ''), 120),
      'utm_medium', left(COALESCE(v_metadata->>'utm_medium', ''), 120),
      'utm_campaign', left(COALESCE(v_metadata->>'utm_campaign', ''), 160),
      'utm_content', left(COALESCE(v_metadata->>'utm_content', ''), 160)
    )
  );

  IF NOT EXISTS (
    SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = 'gsa_public_create_enterprise_budget'
  ) THEN
    RAISE EXCEPTION 'Serviço de orçamento indisponível.' USING ERRCODE = 'P0001';
  END IF;

  -- A função antiga continua responsável pela persistência, mas deixa de ser pública.
  EXECUTE 'SELECT public.gsa_public_create_enterprise_budget($1)' USING v_sanitized;

  DELETE FROM public.gsa_public_budget_rate_limits
   WHERE updated_at < v_now - interval '30 days';

  RETURN jsonb_build_object('success', true, 'protocol', v_protocol);
END;
$$;

-- File: 20260721003000_hash_collaborator_credentials.sql
-- Function: gsa_login_colaborador
CREATE OR REPLACE FUNCTION public.gsa_login_colaborador(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_code text := trim(COALESCE(p_code, ''));
  v_collaborator_id uuid;
  v_internal_code text;
  v_status text;
  v_result jsonb;
BEGIN
  IF length(v_code) < 6 OR length(v_code) > 128 THEN
    RETURN jsonb_build_object('valid', false, 'success', false, 'error', 'invalid_credentials');
  END IF;

  SELECT c.id, c.credencial_acesso, lower(COALESCE(c.status, 'ativo'))
    INTO v_collaborator_id, v_internal_code, v_status
    FROM public.colaboradores c
   WHERE c.credencial_hash IS NOT NULL
     AND crypt(v_code, c.credencial_hash) = c.credencial_hash
   LIMIT 1;

  IF v_collaborator_id IS NULL
     OR v_status IN ('suspenso', 'bloqueado', 'inativo', 'excluido', 'excluído', 'cancelado') THEN
    RETURN jsonb_build_object('valid', false, 'success', false, 'error', 'invalid_credentials');
  END IF;

  EXECUTE 'SELECT public.gsa_login_colaborador_legacy($1)::jsonb'
     INTO v_result
     USING v_internal_code;

  IF v_result IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'success', false, 'error', 'authentication_failed');
  END IF;

  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Falha no login seguro do colaborador %: %', v_collaborator_id, SQLERRM;
  RETURN jsonb_build_object('valid', false, 'success', false, 'error', 'authentication_failed');
            RAISE EXCEPTION 'Erro em gsa_login_colaborador: %', SQLERRM;
        END;
$$;

-- File: 20260721003800_admin_session_token_validation_compat.sql
-- Function: gsa_admin_validate_context
CREATE OR REPLACE FUNCTION public.gsa_admin_validate_context(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_context jsonb := public.gsa_admin_context();
  v_session jsonb;
  v_stored_token text;
  v_token_valid boolean := false;
  v_legacy_validation jsonb;
BEGIN
  IF p_sessao_id IS NOT NULL
     AND p_sessao_id::text <> COALESCE(v_context ->> 'session_id', '') THEN
    RAISE EXCEPTION 'A sessão informada não corresponde ao JWT atual.' USING ERRCODE = '42501';
  END IF;

  IF p_sessao_id IS NULL AND p_session_token IS NULL THEN
    RETURN v_context;
  END IF;

  IF p_sessao_id IS NULL OR COALESCE(p_session_token, '') = '' THEN
    RAISE EXCEPTION 'Identificação completa da sessão é obrigatória.' USING ERRCODE = '42501';
  END IF;

  SELECT to_jsonb(s)
    INTO v_session
    FROM public.sistema_sessoes s
   WHERE s.id = p_sessao_id
   LIMIT 1;

  IF v_session IS NULL THEN
    RAISE EXCEPTION 'Sessão administrativa revogada.' USING ERRCODE = '42501';
  END IF;

  v_stored_token := COALESCE(
    v_session ->> 'session_token',
    v_session ->> 'sessao_token',
    v_session ->> 'token',
    v_session ->> 'session_token_hash',
    v_session ->> 'token_hash',
    ''
  );

  IF v_stored_token <> '' THEN
    v_token_valid := v_stored_token = p_session_token;

    IF NOT v_token_valid AND v_stored_token LIKE '$2%' THEN
      BEGIN
        v_token_valid := crypt(p_session_token, v_stored_token) = v_stored_token;
      EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'Erro em gsa_admin_validate_context: %', SQLERRM;
        END;
    END IF;

    IF NOT v_token_valid AND v_stored_token ~ '^[0-9a-fA-F]{64}$' THEN
      v_token_valid := lower(v_stored_token) = encode(digest(p_session_token, 'sha256'), 'hex');
    END IF;
  ELSE
    -- Compatibilidade apenas para instalações cujo segredo não está exposto na
    -- linha da sessão. Aceitamos somente respostas positivas explícitas.
    BEGIN
      EXECUTE
        'SELECT to_jsonb(v) FROM public.gsa_validate_session($1, $2) v LIMIT 1'
        INTO v_legacy_validation
        USING p_sessao_id, p_session_token;

      v_token_valid := lower(COALESCE(
        v_legacy_validation ->> 'is_valid',
        v_legacy_validation ->> 'valid',
        v_legacy_validation ->> 'success',
        'false'
      )) IN ('true', 't', '1');
    EXCEPTION WHEN undefined_function THEN
      v_token_valid := false;
    END;
  END IF;

  IF NOT v_token_valid THEN
    RAISE EXCEPTION 'Sessão administrativa inválida ou expirada.' USING ERRCODE = '42501';
  END IF;

  RETURN v_context;
END;
$$;

-- File: 20260721124500_finalize_public_home_budget.sql
-- Function: gsa_public_create_enterprise_budget_v2
CREATE OR REPLACE FUNCTION public.gsa_public_create_enterprise_budget_v2(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_name text;
  v_email text;
  v_phone text;
  v_type text;
  v_request text;
  v_honeypot text;
  v_started_at timestamptz;
  v_now timestamptz := clock_timestamp();
  v_fingerprint text;
  v_decoy_protocol text;
  v_rate public.gsa_public_budget_rate_limits%ROWTYPE;
  v_metadata jsonb;
  v_sanitized jsonb;
  v_internal jsonb;
  v_persisted_protocol text;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'Dados da solicitacao invalidos.' USING ERRCODE = '22023';
  END IF;

  v_name := btrim(COALESCE(p_payload->>'nome', ''));
  v_email := lower(btrim(COALESCE(p_payload->>'email', '')));
  v_phone := regexp_replace(COALESCE(p_payload->>'telefone', ''), '\D', '', 'g');
  v_type := lower(btrim(COALESCE(p_payload->>'tipo', '')));
  v_request := btrim(COALESCE(p_payload->>'solicitacao', ''));
  v_honeypot := btrim(COALESCE(p_payload->>'website', ''));
  v_metadata := CASE
    WHEN jsonb_typeof(p_payload->'metadata') = 'object' THEN p_payload->'metadata'
    ELSE '{}'::jsonb
  END;

  v_decoy_protocol := 'GSA-' || to_char(v_now AT TIME ZONE 'America/Sao_Paulo', 'YYYYMMDD') || '-' ||
    upper(substr(md5(random()::text || v_now::text), 1, 6));

  -- Robos recebem resposta neutra, sem gravar lead.
  IF v_honeypot <> '' THEN
    RETURN jsonb_build_object('success', true, 'protocol', v_decoy_protocol);
  END IF;

  IF char_length(v_name) < 2 OR char_length(v_name) > 120 THEN
    RAISE EXCEPTION 'Nome invalido.' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_email) > 160 OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'E-mail invalido.' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_phone) NOT BETWEEN 10 AND 11 THEN
    RAISE EXCEPTION 'Telefone invalido.' USING ERRCODE = '22023';
  END IF;
  IF v_type NOT IN ('site', 'loja', 'sistema', 'aplicativo', 'automacao', 'integracao') THEN
    RAISE EXCEPTION 'Tipo de projeto invalido.' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_request) < 20 OR char_length(v_request) > 2000 THEN
    RAISE EXCEPTION 'Descricao invalida.' USING ERRCODE = '22023';
  END IF;

  BEGIN
    v_started_at := (p_payload->>'started_at')::timestamptz;
  EXCEPTION WHEN OTHERS THEN
            RAISE
            RAISE EXCEPTION 'Erro em gsa_public_create_enterprise_budget_v2: %', SQLERRM;
        EXCEPTION 'Tempo de preenchimento invalido.' USING ERRCODE = '22023';
  END;

  IF v_started_at > v_now
     OR v_now - v_started_at < interval '2 seconds'
     OR v_now - v_started_at > interval '2 hours' THEN
    RAISE EXCEPTION 'Tempo de preenchimento invalido.' USING ERRCODE = '22023';
  END IF;

  v_fingerprint := md5(v_email || ':' || v_phone);
  INSERT INTO public.gsa_public_budget_rate_limits(
    fingerprint, window_started_at, attempts, updated_at
  ) VALUES (
    v_fingerprint, v_now, 0, v_now
  ) ON CONFLICT (fingerprint) DO NOTHING;

  SELECT * INTO v_rate
  FROM public.gsa_public_budget_rate_limits
  WHERE fingerprint = v_fingerprint
  FOR UPDATE;

  IF v_rate.blocked_until IS NOT NULL AND v_rate.blocked_until > v_now THEN
    RAISE EXCEPTION 'Limite temporario de solicitacoes atingido.' USING ERRCODE = 'P0001';
  END IF;

  IF v_rate.window_started_at < v_now - interval '1 hour' THEN
    UPDATE public.gsa_public_budget_rate_limits
    SET window_started_at = v_now,
        attempts = 0,
        blocked_until = NULL,
        updated_at = v_now
    WHERE fingerprint = v_fingerprint;
    v_rate.attempts := 0;
  END IF;

  IF v_rate.attempts >= 4 THEN
    UPDATE public.gsa_public_budget_rate_limits
    SET blocked_until = v_now + interval '2 hours',
        updated_at = v_now
    WHERE fingerprint = v_fingerprint;
    RAISE EXCEPTION 'Limite temporario de solicitacoes atingido.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.gsa_public_budget_rate_limits
  SET attempts = attempts + 1,
      updated_at = v_now
  WHERE fingerprint = v_fingerprint;

  v_sanitized := jsonb_build_object(
    'nome', v_name,
    'email', v_email,
    'telefone', v_phone,
    'tipo', v_type,
    'solicitacao', v_request,
    'origem', 'public_sites_systems',
    'data_envio', v_now,
    'metadata', jsonb_build_object(
      'source', left(COALESCE(v_metadata->>'source', 'public_sites_systems'), 80),
      'page', left(COALESCE(v_metadata->>'page', ''), 300),
      'referrer', left(COALESCE(v_metadata->>'referrer', ''), 500),
      'utm_source', left(COALESCE(v_metadata->>'utm_source', ''), 120),
      'utm_medium', left(COALESCE(v_metadata->>'utm_medium', ''), 120),
      'utm_campaign', left(COALESCE(v_metadata->>'utm_campaign', ''), 160),
      'utm_content', left(COALESCE(v_metadata->>'utm_content', ''), 160)
    )
  );

  SELECT public.gsa_public_create_enterprise_budget(v_sanitized) INTO v_internal;
  v_persisted_protocol := nullif(v_internal->>'codigo_orcamento', '');
  IF NOT coalesce((v_internal->>'success')::boolean, false) OR v_persisted_protocol IS NULL THEN
    RAISE EXCEPTION 'Servico de orcamento indisponivel.' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM public.gsa_public_budget_rate_limits
  WHERE updated_at < v_now - interval '30 days';

  RETURN jsonb_build_object(
    'success', true,
    'protocol', v_persisted_protocol,
    'budget_id', v_internal->>'orcamento_id',
    'already_exists', coalesce((v_internal->>'already_exists')::boolean, false)
  );
END;
$$;

-- File: 20260721233000_classifieds_review_adjustment_flow.sql
-- Function: gsa_admin_request_classified_adjustments
CREATE OR REPLACE FUNCTION public.gsa_admin_request_classified_adjustments(
  p_anuncio_id uuid,
  p_campos jsonb,
  p_observacao text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_context jsonb;
  v_actor_id uuid;
  v_item jsonb;
  v_field text;
  v_adjustment_id uuid;
BEGIN
  v_context := public.gsa_admin_context();
  IF COALESCE(v_context ->> 'actor_type', '') NOT IN ('admin','colaborador') THEN
    RAISE EXCEPTION 'Sessão administrativa obrigatória.' USING ERRCODE='42501';
  END IF;
  IF (v_context ->> 'actor_type') = 'colaborador'
     AND NOT COALESCE(public.gsa_admin_has_module('classificados'), false) THEN
    RAISE EXCEPTION 'Sem permissão para solicitar ajustes.' USING ERRCODE='42501';
  END IF;

  IF p_campos IS NULL OR jsonb_typeof(p_campos) <> 'array' OR jsonb_array_length(p_campos) = 0 THEN
    RAISE EXCEPTION 'Selecione pelo menos um campo para ajuste.' USING ERRCODE='22023';
  END IF;
  IF length(trim(COALESCE(p_observacao,''))) < 5 THEN
    RAISE EXCEPTION 'Informe uma orientação clara para o anunciante.' USING ERRCODE='22023';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_campos)
  LOOP
    v_field := trim(BOTH '"' FROM v_item::text);
    IF v_field = '' OR length(v_field) > 100 THEN
      RAISE EXCEPTION 'Campo de ajuste inválido.' USING ERRCODE='22023';
    END IF;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM public.classificados_anuncios WHERE id=p_anuncio_id) THEN
    RAISE EXCEPTION 'Anúncio não encontrado.' USING ERRCODE='P0002';
  END IF;

  BEGIN
    v_actor_id := NULLIF(v_context->>'actor_id','')::uuid;
  EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'Erro em gsa_admin_request_classified_adjustments: %', SQLERRM;
        END;

  UPDATE public.classificados_ajustes
  SET status='cancelado', resolvido_at=now()
  WHERE anuncio_id=p_anuncio_id AND status='pendente';

  INSERT INTO public.classificados_ajustes(anuncio_id, campos, observacao, status, solicitado_por)
  VALUES (p_anuncio_id, p_campos, trim(p_observacao), 'pendente', v_actor_id)
  RETURNING id INTO v_adjustment_id;

  UPDATE public.classificados_anuncios
  SET status='ajustes_solicitados', updated_at=now()
  WHERE id=p_anuncio_id;

  RETURN jsonb_build_object('success',true,'ajuste_id',v_adjustment_id,'status','ajustes_solicitados');
END;
$$;

-- File: 20260722180000_create_gsa_careers_foundation.sql
-- Function: gsa_public_submit_career_application
CREATE OR REPLACE FUNCTION public.gsa_public_submit_career_application(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_protocol text;
  v_app_id uuid;
  v_doc text;
  v_name text;
  v_email text;
  v_phone text;
  v_area text;
  v_type text;
  v_salary numeric(12,2);
  v_resume text;
  v_linkedin text;
  v_notes text;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'Payload invalido' USING ERRCODE = '22023';
  END IF;

  v_name := trim(COALESCE(p_payload->>'candidate_name', ''));
  v_doc := regexp_replace(COALESCE(p_payload->>'document', ''), '[^0-9]', '', 'g');
  v_email := lower(trim(COALESCE(p_payload->>'email', '')));
  v_phone := regexp_replace(COALESCE(p_payload->>'phone', ''), '[^0-9]', '', 'g');
  v_area := trim(COALESCE(p_payload->>'desired_area', 'Geral'));
  v_type := lower(trim(COALESCE(p_payload->>'employment_type', 'clt')));
  v_resume := nullif(trim(COALESCE(p_payload->>'resume_url', '')), '');
  v_linkedin := nullif(trim(COALESCE(p_payload->>'linkedin_url', '')), '');
  v_notes := nullif(trim(COALESCE(p_payload->>'notes', '')), '');

  IF p_payload->>'salary_expectation' IS NOT NULL AND p_payload->>'salary_expectation' <> '' THEN
    BEGIN
      v_salary := (p_payload->>'salary_expectation')::numeric;
    EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'Erro em gsa_public_submit_career_application: %', SQLERRM;
        END;
  END IF;

  IF length(v_name) < 2 OR length(v_doc) < 11 OR v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(v_phone) < 10 THEN
    RAISE EXCEPTION 'Dados obrigatorios invalidos' USING ERRCODE = '22023';
  END IF;

  IF v_type NOT IN ('clt', 'estagio') THEN
    v_type := 'clt';
  END IF;

  v_protocol := 'RH-' || to_char(current_date, 'YYYYMMDD') || '-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 8));

  INSERT INTO public.gsa_careers_applications (
    protocol, candidate_name, document, email, phone, desired_area,
    employment_type, salary_expectation, resume_url, linkedin_url, notes
  ) VALUES (
    v_protocol, v_name, v_doc, v_email, v_phone, v_area,
    v_type, v_salary, v_resume, v_linkedin, v_notes
  ) RETURNING id INTO v_app_id;

  RETURN jsonb_build_object(
    'success', true,
    'protocol', v_protocol,
    'id', v_app_id
  );
END;
$$;

-- File: 20260722235959_harden_gsa_careers_flow.sql
-- Function: gsa_public_submit_career_application
CREATE OR REPLACE FUNCTION public.gsa_public_submit_career_application(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_application_id uuid := gen_random_uuid();
  v_protocol text;
  v_existing public.gsa_careers_applications%ROWTYPE;
  v_document text;
  v_name text;
  v_email text;
  v_phone text;
  v_area text;
  v_type text;
  v_salary numeric(12,2);
  v_linkedin text;
  v_notes text;
  v_resume_name text;
  v_resume_mime text;
  v_resume_size bigint;
  v_resume_path text;
  v_safe_name text;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'Payload invalido' USING ERRCODE = '22023';
  END IF;

  v_name := trim(COALESCE(p_payload->>'candidate_name', ''));
  v_document := regexp_replace(COALESCE(p_payload->>'document', ''), '[^0-9]', '', 'g');
  v_email := lower(trim(COALESCE(p_payload->>'email', '')));
  v_phone := regexp_replace(COALESCE(p_payload->>'phone', ''), '[^0-9]', '', 'g');
  v_area := trim(COALESCE(p_payload->>'desired_area', ''));
  v_type := lower(trim(COALESCE(p_payload->>'employment_type', '')));
  v_linkedin := nullif(trim(COALESCE(p_payload->>'linkedin_url', '')), '');
  v_notes := nullif(trim(COALESCE(p_payload->>'notes', '')), '');
  v_resume_name := nullif(trim(COALESCE(p_payload->>'resume_file_name', '')), '');
  v_resume_mime := lower(nullif(trim(COALESCE(p_payload->>'resume_mime_type', '')), ''));
  v_resume_size := NULLIF(COALESCE(p_payload->>'resume_size', ''), '')::bigint;

  IF length(v_name) < 3 OR length(v_name) > 160 THEN
    RAISE EXCEPTION 'Nome completo invalido' USING ERRCODE = '22023';
  END IF;
  IF NOT public.gsa_careers_validate_cpf(v_document) THEN
    RAISE EXCEPTION 'CPF invalido' USING ERRCODE = '22023';
  END IF;
  IF v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(v_email) > 200 THEN
    RAISE EXCEPTION 'Email invalido' USING ERRCODE = '22023';
  END IF;
  IF length(v_phone) NOT BETWEEN 10 AND 13 THEN
    RAISE EXCEPTION 'Telefone invalido' USING ERRCODE = '22023';
  END IF;
  IF v_area NOT IN (
    'Comercial & Vendas',
    'Tecnologia & Desenvolvimento',
    'Operações & Logística',
    'Suporte & Relacionamento',
    'Financeiro & Administração'
  ) THEN
    RAISE EXCEPTION 'Area de interesse invalida' USING ERRCODE = '22023';
  END IF;
  IF v_type NOT IN ('clt', 'estagio') THEN
    RAISE EXCEPTION 'Modalidade invalida' USING ERRCODE = '22023';
  END IF;
  IF v_linkedin IS NOT NULL AND v_linkedin !~* '^https?://' THEN
    RAISE EXCEPTION 'URL do LinkedIn invalida' USING ERRCODE = '22023';
  END IF;
  IF length(COALESCE(v_notes, '')) > 4000 THEN
    RAISE EXCEPTION 'Mensagem muito extensa' USING ERRCODE = '22023';
  END IF;

  IF NULLIF(COALESCE(p_payload->>'salary_expectation', ''), '') IS NOT NULL THEN
    BEGIN
      v_salary := (p_payload->>'salary_expectation')::numeric;
    EXCEPTION WHEN OTHERS THEN
            RAISE
            RAISE EXCEPTION 'Erro em gsa_public_submit_career_application: %', SQLERRM;
        EXCEPTION 'Pretensao salarial invalida' USING ERRCODE = '22023';
    END;
    IF v_salary < 0 OR v_salary > 99999999.99 THEN
      RAISE EXCEPTION 'Pretensao salarial fora do limite' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF v_resume_name IS NOT NULL THEN
    IF v_resume_size IS NULL OR v_resume_size <= 0 OR v_resume_size > 10485760 THEN
      RAISE EXCEPTION 'Curriculo deve possuir no maximo 10 MB' USING ERRCODE = '22023';
    END IF;
    IF v_resume_mime NOT IN (
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/webp'
    ) THEN
      RAISE EXCEPTION 'Formato de curriculo nao permitido' USING ERRCODE = '22023';
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_document || '|' || lower(v_area), 0));

  SELECT *
  INTO v_existing
  FROM public.gsa_careers_applications
  WHERE document = v_document
    AND lower(desired_area) = lower(v_area)
    AND status IN ('received', 'under_review', 'interview_scheduled', 'approved', 'talent_pool')
    AND created_at >= now() - interval '180 days'
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_exists', true,
      'protocol', v_existing.protocol,
      'id', v_existing.id,
      'resume_upload_path', CASE
        WHEN v_resume_name IS NOT NULL AND v_existing.resume_uploaded_at IS NULL
          THEN v_existing.resume_storage_path
        ELSE NULL
      END
    );
  END IF;

  IF v_resume_name IS NOT NULL THEN
    v_safe_name := regexp_replace(
      regexp_replace(lower(v_resume_name), '[^a-z0-9._-]+', '_', 'g'),
      '^[_\.]+|[_\.]+$', '', 'g'
    );
    IF v_safe_name = '' THEN v_safe_name := 'curriculo'; END IF;
    v_safe_name := right(v_safe_name, 120);
    v_resume_path := 'applications/' || v_application_id::text || '/' ||
      encode(gen_random_bytes(16), 'hex') || '-' || v_safe_name;
  END IF;

  v_protocol := 'RH-' || to_char(current_date, 'YYYYMMDD') || '-' ||
    upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 10));

  INSERT INTO public.gsa_careers_applications (
    id,
    protocol,
    candidate_name,
    document,
    email,
    phone,
    desired_area,
    employment_type,
    salary_expectation,
    resume_url,
    resume_storage_path,
    linkedin_url,
    notes,
    status,
    public_message,
    status_changed_at
  ) VALUES (
    v_application_id,
    v_protocol,
    v_name,
    v_document,
    v_email,
    v_phone,
    v_area,
    v_type,
    v_salary,
    NULL,
    v_resume_path,
    v_linkedin,
    v_notes,
    'received',
    'Candidatura recebida. A equipe de Recursos Humanos fará a análise inicial do perfil.',
    now()
  );

  INSERT INTO public.gsa_careers_application_history (
    application_id, from_status, to_status, actor_type, actor_name, note
  ) VALUES (
    v_application_id, NULL, 'received', 'candidate', v_name, 'Candidatura enviada pelo portal público.'
  );

  RETURN jsonb_build_object(
    'success', true,
    'already_exists', false,
    'protocol', v_protocol,
    'id', v_application_id,
    'resume_upload_path', v_resume_path
  );
END;
$$;

-- File: 20260722235959_harden_gsa_careers_flow.sql
-- Function: gsa_admin_update_career_application
CREATE OR REPLACE FUNCTION public.gsa_admin_update_career_application(
  p_sessao_id uuid,
  p_session_token text,
  p_application_id uuid,
  p_status text,
  p_internal_notes text DEFAULT NULL,
  p_interview_at timestamptz DEFAULT NULL,
  p_interview_location text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_context jsonb;
  v_application public.gsa_careers_applications%ROWTYPE;
  v_new_status text := lower(trim(COALESCE(p_status, '')));
  v_actor_type text;
  v_actor_id uuid;
  v_actor_name text;
  v_public_message text;
BEGIN
  v_context := public.gsa_careers_admin_context(p_sessao_id, p_session_token);
  v_actor_type := COALESCE(v_context->>'actor_type', v_context->>'ator_tipo');
  v_actor_name := COALESCE(v_context->>'actor_name', v_context->>'ator_nome', 'Administrador');
  BEGIN
    v_actor_id := COALESCE(v_context->>'actor_id', v_context->>'ator_id')::uuid;
  EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'Erro em gsa_admin_update_career_application: %', SQLERRM;
        END;

  IF v_new_status NOT IN ('received', 'under_review', 'interview_scheduled', 'approved', 'talent_pool', 'rejected') THEN
    RAISE EXCEPTION 'Status invalido' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_application
  FROM public.gsa_careers_applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Candidatura nao encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF v_new_status <> v_application.status AND NOT (
    (v_application.status = 'received' AND v_new_status IN ('under_review', 'talent_pool', 'rejected')) OR
    (v_application.status = 'under_review' AND v_new_status IN ('interview_scheduled', 'approved', 'talent_pool', 'rejected')) OR
    (v_application.status = 'interview_scheduled' AND v_new_status IN ('under_review', 'approved', 'talent_pool', 'rejected')) OR
    (v_application.status = 'talent_pool' AND v_new_status IN ('under_review', 'interview_scheduled', 'rejected')) OR
    (v_application.status = 'rejected' AND v_new_status = 'under_review') OR
    (v_application.status = 'approved' AND v_new_status = 'under_review')
  ) THEN
    RAISE EXCEPTION 'Transicao de status nao permitida: % para %', v_application.status, v_new_status
      USING ERRCODE = '22023';
  END IF;

  IF v_new_status = 'interview_scheduled' THEN
    IF p_interview_at IS NULL OR trim(COALESCE(p_interview_location, '')) = '' THEN
      RAISE EXCEPTION 'Data e local/link da entrevista sao obrigatorios' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF v_new_status = 'rejected' AND trim(COALESCE(p_internal_notes, '')) = '' THEN
    RAISE EXCEPTION 'O motivo interno do encerramento e obrigatorio' USING ERRCODE = '22023';
  END IF;

  v_public_message := CASE v_new_status
    WHEN 'received' THEN 'Candidatura recebida. A equipe de Recursos Humanos fará a análise inicial do perfil.'
    WHEN 'under_review' THEN 'Seu perfil está em análise pela equipe de Recursos Humanos.'
    WHEN 'interview_scheduled' THEN 'Você avançou para a etapa de entrevista. Consulte os dados de agendamento abaixo.'
    WHEN 'approved' THEN 'Você foi aprovado no processo seletivo. A equipe de Recursos Humanos entrará em contato para os próximos procedimentos.'
    WHEN 'talent_pool' THEN 'Seu perfil foi incluído em nosso Banco de Talentos para futuras oportunidades compatíveis.'
    WHEN 'rejected' THEN 'Este processo seletivo foi encerrado. Agradecemos seu interesse em fazer parte do Grupo GSA.'
  END;

  UPDATE public.gsa_careers_applications
  SET status = v_new_status,
      internal_notes = nullif(trim(COALESCE(p_internal_notes, '')), ''),
      public_message = v_public_message,
      interview_at = CASE WHEN v_new_status = 'interview_scheduled' THEN p_interview_at ELSE interview_at END,
      interview_location = CASE WHEN v_new_status = 'interview_scheduled' THEN trim(p_interview_location) ELSE interview_location END,
      status_changed_at = CASE WHEN v_new_status <> v_application.status THEN now() ELSE status_changed_at END,
      closed_at = CASE WHEN v_new_status IN ('approved', 'rejected') THEN now() ELSE NULL END,
      updated_at = now()
  WHERE id = p_application_id;

  IF v_new_status <> v_application.status THEN
    INSERT INTO public.gsa_careers_application_history (
      application_id,
      from_status,
      to_status,
      actor_type,
      actor_id,
      actor_name,
      note,
      interview_at,
      interview_location
    ) VALUES (
      p_application_id,
      v_application.status,
      v_new_status,
      v_actor_type,
      v_actor_id,
      v_actor_name,
      nullif(trim(COALESCE(p_internal_notes, '')), ''),
      CASE WHEN v_new_status = 'interview_scheduled' THEN p_interview_at ELSE NULL END,
      CASE WHEN v_new_status = 'interview_scheduled' THEN trim(p_interview_location) ELSE NULL END
    );
  END IF;

  RETURN public.gsa_admin_get_career_application(
    p_sessao_id,
    p_session_token,
    p_application_id
  );
END;
$$;

-- File: 20260723120000_system_db_alignment.sql
-- Function: sync_cliente_pontos_e_saldo
CREATE OR REPLACE FUNCTION public.sync_cliente_pontos_e_saldo(
    p_cliente_id UUID,
    p_pontos_delta INT DEFAULT 0,
    p_saldo_delta NUMERIC DEFAULT 0,
    p_descricao TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_novo_saldo NUMERIC;
    v_novos_pontos INT;
BEGIN
    UPDATE public.clientes
    SET 
        saldo_carteira = COALESCE(saldo_carteira, 0) + p_saldo_delta,
        saldo_pontos = COALESCE(saldo_pontos, 0) + p_pontos_delta,
        updated_at = NOW()
    WHERE id = p_cliente_id
    RETURNING saldo_carteira, saldo_pontos INTO v_novo_saldo, v_novos_pontos;

    IF p_pontos_delta <> 0 THEN
        INSERT INTO public.points_transactions (cliente_id, tipo, pontos, descricao, created_at)
        VALUES (p_cliente_id, CASE WHEN p_pontos_delta > 0 THEN 'credito' ELSE 'debito' END, p_pontos_delta, p_descricao, NOW());
        
        INSERT INTO public.pontos_movimentacoes (cliente_id, tipo, pontos, descricao, created_at)
        VALUES (p_cliente_id, CASE WHEN p_pontos_delta > 0 THEN 'credito' ELSE 'debito' END, p_pontos_delta, p_descricao, NOW());
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'novo_saldo', v_novo_saldo,
        'novos_pontos', v_novos_pontos
    );
EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'Erro em sync_cliente_pontos_e_saldo: %', SQLERRM;
        END;
$$;

-- File: 20260723233000_free_tools_pro_access.sql
-- Function: gsa_admin_create_calculator_pro_voucher
CREATE OR REPLACE FUNCTION public.gsa_admin_create_calculator_pro_voucher(
  p_sessao_id uuid,
  p_session_token text,
  p_tool_id text,
  p_expires_at timestamptz DEFAULT NULL,
  p_observacoes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_code text;
  v_id uuid;
  v_actor uuid;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  IF p_tool_id IS NOT NULL AND p_tool_id NOT IN ('termination','retirement','vacation') THEN
    RAISE EXCEPTION 'Calculadora inválida' USING ERRCODE = '22023';
  END IF;
  IF p_expires_at IS NOT NULL AND p_expires_at <= now() THEN
    RAISE EXCEPTION 'A validade precisa estar no futuro' USING ERRCODE = '22023';
  END IF;

  v_code := 'GSA-PRO-' || upper(encode(gen_random_bytes(5), 'hex'));
  BEGIN
    SELECT public.gsa_current_actor_id() INTO v_actor;
  EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'Erro em gsa_admin_create_calculator_pro_voucher: %', SQLERRM;
        END;

  INSERT INTO public.gsa_calculator_pro_vouchers (
    code_hash, code_hint, tool_id, expires_at, observacoes, created_by
  ) VALUES (
    encode(digest(upper(v_code), 'sha256'), 'hex'),
    right(v_code, 6),
    p_tool_id,
    p_expires_at,
    nullif(btrim(p_observacoes), ''),
    v_actor
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'id', v_id, 'code', v_code);
END;
$$;

-- File: 20260723233000_free_tools_pro_access.sql
-- Function: gsa_admin_grant_calculator_pro
CREATE OR REPLACE FUNCTION public.gsa_admin_grant_calculator_pro(
  p_sessao_id uuid,
  p_session_token text,
  p_cliente_id uuid,
  p_tool_id text,
  p_valid_until timestamptz,
  p_observacoes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_actor uuid;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  IF p_tool_id NOT IN ('termination','retirement','vacation') THEN RAISE EXCEPTION 'Calculadora inválida'; END IF;
  IF p_valid_until IS NULL OR p_valid_until <= now() THEN RAISE EXCEPTION 'A validade precisa estar no futuro'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clientes WHERE id = p_cliente_id) THEN RAISE EXCEPTION 'Cliente não encontrado'; END IF;
  BEGIN SELECT public.gsa_current_actor_id() INTO v_actor; EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'Erro em gsa_admin_grant_calculator_pro: %', SQLERRM;
        END;

  INSERT INTO public.gsa_calculator_pro_grants (
    tool_id, source, cliente_id, valid_until, observacoes, created_by
  ) VALUES (
    p_tool_id, 'manual', p_cliente_id, p_valid_until, nullif(btrim(p_observacoes), ''), v_actor
  ) RETURNING id INTO v_id;

  INSERT INTO public.gsa_calculator_pro_events(event_type, tool_id, grant_id, cliente_id, details)
  VALUES ('manual_grant_created', p_tool_id, v_id, p_cliente_id, jsonb_build_object('valid_until', p_valid_until));

  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;

-- File: 20260724163000_harden_calculator_pro_voucher_payment.sql
-- Function: gsa_admin_save_calculator_pro_runtime_config
CREATE OR REPLACE FUNCTION public.gsa_admin_save_calculator_pro_runtime_config(
  p_sessao_id uuid,
  p_session_token text,
  p_infinitepay_handle text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_handle text;
  v_actor uuid;
  v_result jsonb;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);

  v_handle := nullif(regexp_replace(btrim(COALESCE(p_infinitepay_handle, '')), '^\$', ''), '');
  IF v_handle IS NOT NULL AND v_handle !~ '^[A-Za-z0-9._-]{2,100}$' THEN
    RAISE EXCEPTION 'InfiniteTag inválida. Informe apenas o nome, sem o símbolo $' USING ERRCODE = '22023';
  END IF;

  BEGIN
    SELECT public.gsa_current_actor_id() INTO v_actor;
  EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'Erro em gsa_admin_save_calculator_pro_runtime_config: %', SQLERRM;
        END;

  INSERT INTO public.gsa_calculator_pro_runtime_config(
    config_key,
    infinitepay_handle,
    updated_by
  ) VALUES (
    'default',
    v_handle,
    v_actor
  )
  ON CONFLICT (config_key) DO UPDATE
    SET infinitepay_handle = EXCLUDED.infinitepay_handle,
        updated_by = EXCLUDED.updated_by
  RETURNING jsonb_build_object(
    'success', true,
    'infinitepay_handle', infinitepay_handle,
    'checkout_ready', infinitepay_handle IS NOT NULL,
    'updated_at', updated_at
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- File: 20260724163000_harden_calculator_pro_voucher_payment.sql
-- Function: gsa_admin_create_calculator_pro_voucher
CREATE OR REPLACE FUNCTION public.gsa_admin_create_calculator_pro_voucher(
  p_sessao_id uuid,
  p_session_token text,
  p_tool_id text,
  p_expires_at timestamptz DEFAULT NULL,
  p_observacoes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_code text;
  v_id uuid;
  v_actor uuid;
  v_attempt integer;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);

  IF p_tool_id IS NOT NULL AND p_tool_id NOT IN ('termination','retirement','vacation') THEN
    RAISE EXCEPTION 'Calculadora inválida' USING ERRCODE = '22023';
  END IF;
  IF p_expires_at IS NOT NULL AND p_expires_at <= now() THEN
    RAISE EXCEPTION 'A validade precisa estar no futuro' USING ERRCODE = '22023';
  END IF;

  BEGIN
    SELECT public.gsa_current_actor_id() INTO v_actor;
  EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'Erro em gsa_admin_create_calculator_pro_voucher: %', SQLERRM;
        END;

  FOR v_attempt IN 1..5 LOOP
    v_code := 'GSA-PRO-' || upper(encode(gen_random_bytes(10), 'hex'));
    BEGIN
      INSERT INTO public.gsa_calculator_pro_vouchers(
        code_hash,
        code_hint,
        tool_id,
        expires_at,
        observacoes,
        created_by
      ) VALUES (
        encode(digest(upper(v_code), 'sha256'), 'hex'),
        right(v_code, 6),
        p_tool_id,
        p_expires_at,
        nullif(btrim(p_observacoes), ''),
        v_actor
      ) RETURNING id INTO v_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempt = 5 THEN
        RAISE;
      END IF;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_id,
    'code', v_code
  );
END;
$$;

-- File: 20260724193000_enable_remaining_free_tools.sql
-- Function: gsa_admin_create_calculator_pro_voucher
CREATE OR REPLACE FUNCTION public.gsa_admin_create_calculator_pro_voucher(
  p_sessao_id uuid,
  p_session_token text,
  p_tool_id text,
  p_expires_at timestamptz DEFAULT NULL,
  p_observacoes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_code text;
  v_id uuid;
  v_actor uuid;
  v_attempt integer;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  IF p_tool_id IS NOT NULL AND p_tool_id NOT IN ('termination','retirement','vacation','thirteenth','benefits','bpc') THEN
    RAISE EXCEPTION 'Calculadora inválida' USING ERRCODE = '22023';
  END IF;
  IF p_expires_at IS NOT NULL AND p_expires_at <= now() THEN
    RAISE EXCEPTION 'A validade precisa estar no futuro' USING ERRCODE = '22023';
  END IF;

  BEGIN
    SELECT public.gsa_current_actor_id() INTO v_actor;
  EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'Erro em gsa_admin_create_calculator_pro_voucher: %', SQLERRM;
        END;

  FOR v_attempt IN 1..5 LOOP
    v_code := 'GSA-PRO-' || upper(encode(gen_random_bytes(10), 'hex'));
    BEGIN
      INSERT INTO public.gsa_calculator_pro_vouchers(
        code_hash, code_hint, tool_id, expires_at, observacoes, created_by
      ) VALUES (
        encode(digest(upper(v_code), 'sha256'), 'hex'),
        right(v_code, 6),
        p_tool_id,
        p_expires_at,
        nullif(btrim(p_observacoes), ''),
        v_actor
      ) RETURNING id INTO v_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempt = 5 THEN RAISE; END IF;
    END;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'id', v_id, 'code', v_code);
END;
$$;

-- File: 20260728040000_fix_exception_handlers.sql
-- Function: fn_processar_upgrade_nivel_automatico
CREATE OR REPLACE FUNCTION fn_processar_upgrade_nivel_automatico()
RETURNS TRIGGER AS $$
DECLARE
    v_new_status TEXT;
    v_old_status TEXT;
    v_tipo TEXT;
    v_pacote_nivel_id UUID;
    v_cliente_id UUID;
    v_nivel_anterior_id UUID;
    v_nivel_nome TEXT;
BEGIN
    v_new_status := NEW.status;
    v_old_status := OLD.status;
    v_tipo := NEW.tipo;
    v_cliente_id := NEW.cliente_id;

    -- Só processa se o status mudou para 'pago' e é uma fatura de pacote_nivel
    IF (v_new_status = 'pago' AND v_old_status IS DISTINCT FROM 'pago' AND v_tipo = 'pacote_nivel' AND NEW.pacote_nivel_id IS NOT NULL) THEN
        
        -- Tenta converter o pacote_nivel_id para UUID. Se falhar (for texto como 'bronze'), busca pelo nome
        BEGIN
            v_pacote_nivel_id := NEW.pacote_nivel_id::UUID;
        EXCEPTION WHEN OTHERS THEN
            RAISE
        EXCEPTION 'Erro em fn_processar_upgrade_nivel_automatico: %', SQLERRM;
        END;

        IF v_pacote_nivel_id IS NOT NULL THEN
            -- Pega o nível atual do cliente para o histórico
            SELECT nivel_id INTO v_nivel_anterior_id FROM clientes WHERE id = v_cliente_id;
            
            -- Pega o nome real do novo nível para a notificação
            SELECT nome_nivel INTO v_nivel_nome FROM client_levels WHERE id = v_pacote_nivel_id;

            -- 1. Atualiza o nível do cliente
            UPDATE clientes 
            SET nivel_id = v_pacote_nivel_id,
                nivel_manual_id = NULL,
                nivel_manual_info = NULL
            WHERE id = v_cliente_id;

            -- 2. Registra no histórico de níveis
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'level_history') THEN
                INSERT INTO level_history (cliente_id, nivel_anterior_id, nivel_novo_id)
                VALUES (v_cliente_id, v_nivel_anterior_id, v_pacote_nivel_id);
            END IF;

-- File: 20260728040000_fix_exception_handlers.sql
-- Function: gsa_request_ip
CREATE OR REPLACE FUNCTION public.gsa_request_ip()
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_headers jsonb;
BEGIN
  BEGIN
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Falha em operação opcional (gsa_request_ip): %', SQLERRM;
            RAISE WARNING 'Falha em operação opcional (gsa_request_ip): %', SQLERRM;
            v_headers := '{}'::jsonb;
        END;

  RETURN coalesce(
    nullif(split_part(v_headers ->> 'x-forwarded-for', ',', 1), ''),
    nullif(v_headers ->> 'cf-connecting-ip', ''),
    nullif(v_headers ->> 'x-real-ip', ''),
    'unknown'
  );
END;
$$;

-- File: 20260728040000_fix_exception_handlers.sql
-- Function: gsa_admin_import_products_batch_v2
CREATE OR REPLACE FUNCTION public.gsa_admin_import_products_batch_v2(
  p_sessao_id uuid,
  p_session_token text,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
            v_tipo_cliente := COALESCE(v_item->>'tipo_cliente', 'todos');
            v_categoria_id := NULLIF(v_item->>'categoria_id', '')::uuid;
            v_ocultar_valor := COALESCE((v_item->>'ocultar_valor')::boolean, false);
            v_visivel_na_loja := COALESCE((v_item->>'visivel_na_loja')::boolean, false);
            v_controle_estoque := COALESCE((v_item->>'controle_estoque')::boolean, false);
            v_estoque_disponivel := COALESCE((v_item->>'estoque_disponivel')::numeric, 0);
            v_imagens := COALESCE(v_item->'imagens', '[]'::jsonb);
            v_fornecedor_config := COALESCE(v_item->'fornecedor_config', '{}'::jsonb);
            v_force_duplicate := COALESCE((v_item->>'force_duplicate')::boolean, false);

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

            -- Generate unique PRD code
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
            RAISE
            RAISE EXCEPTION 'Erro em gsa_admin_import_products_batch_v2: %', SQLERRM;
        EXCEPTION 'Erro em gsa_admin_import_products_batch_v2: %', SQLERRM;
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
                'criados', COALESCE(array_length(v_created, 1), 0),
                'ignorados', COALESCE(array_length(v_skipped, 1), 0),
                'falhas', COALESCE(array_length(v_failed, 1), 0)
            )::text
        );
    END IF;

    RETURN jsonb_build_object(
        'created', COALESCE(to_jsonb(v_created), '[]'::jsonb),
        'skipped', COALESCE(to_jsonb(v_skipped), '[]'::jsonb),
        'failed', COALESCE(to_jsonb(v_failed), '[]'::jsonb)
    );
END;
$$;

-- File: 20260728040000_fix_exception_handlers.sql
-- Function: gsa_client_seguros_criar_cotacao
CREATE OR REPLACE FUNCTION public.gsa_client_seguros_criar_cotacao(p_sessao_id uuid,p_session_token text,p_payload jsonb,p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_cliente uuid;v_id uuid;v_protocolo text;v_valor numeric;v_produto uuid;
BEGIN
 SELECT ator_id INTO v_cliente FROM gsa_validate_session(p_sessao_id,p_session_token) WHERE is_valid AND ator_tipo='cliente' LIMIT 1;
 IF v_cliente IS NULL THEN RAISE EXCEPTION 'Sessão de cliente inválida ou expirada.'; END IF;
 IF coalesce(p_payload->>'categoria','')='' OR coalesce(p_payload->>'consentimento','')<>'sim' THEN RAISE EXCEPTION 'Categoria e consentimento são obrigatórios.'; END IF;
 SELECT id,protocolo INTO v_id,v_protocolo FROM seguros_cotacoes WHERE cliente_id=v_cliente AND idempotency_key=p_idempotency_key;
 IF v_id IS NOT NULL THEN RETURN jsonb_build_object('success',true,'id',v_id,'protocolo',v_protocolo,'idempotent',true); END IF;
 BEGIN v_valor:=nullif(regexp_replace(coalesce(p_payload->>'valor_risco',''),'[^0-9,.]','','g'),'')::numeric; EXCEPTION WHEN OTHERS THEN
            RAISE
            RAISE EXCEPTION 'Erro em gsa_client_seguros_criar_cotacao: %', SQLERRM;
        EXCEPTION 'Erro em gsa_client_seguros_criar_cotacao: %', SQLERRM;
        END;
 v_protocolo:='SEG-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
 SELECT id INTO v_produto FROM seguros_produtos WHERE id::text=coalesce(p_payload->>'oferta_id','') OR slug=coalesce(p_payload->>'oferta_slug','') LIMIT 1;
 INSERT INTO seguros_cotacoes(cliente_id,produto_id,protocolo,categoria,localidade,inicio_desejado,objeto_segurado,valor_risco,dados,idempotency_key)
 VALUES(v_cliente,v_produto,v_protocolo,p_payload->>'categoria',p_payload->>'localidade',nullif(p_payload->>'inicio_desejado','')::date,p_payload->>'objeto_segurado',v_valor,p_payload,p_idempotency_key) RETURNING id INTO v_id;
 INSERT INTO seguros_auditoria(ator_tipo,ator_id,acao,entidade,entidade_id) VALUES('cliente',v_cliente,'criar_cotacao','seguros_cotacoes',v_id);
 RETURN jsonb_build_object('success',true,'id',v_id,'protocolo',v_protocolo);
END $$;

-- File: 20260728040000_fix_exception_handlers.sql
-- Function: gsa_travel_safe_nonnegative_int
CREATE OR REPLACE FUNCTION public.gsa_travel_safe_nonnegative_int(p_value TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_value IS NULL OR p_value !~ '^\d+$' THEN
    RETURN 0;
  END IF;

  RETURN LEAST(p_value::INTEGER, 100);
EXCEPTION WHEN OTHERS THEN
            RAISE
            RAISE EXCEPTION 'Erro em gsa_travel_safe_nonnegative_int: %', SQLERRM;
        EXCEPTION 'Erro em gsa_travel_safe_nonnegative_int: %', SQLERRM;
        END;
$$;

-- File: 20260728040000_fix_exception_handlers.sql
-- Function: gsa_process_due_store_credit_releases
CREATE OR REPLACE FUNCTION public.gsa_process_due_store_credit_releases()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_solicitacao public.loja_credito_solicitacoes%ROWTYPE;
  v_cliente public.clientes%ROWTYPE;
  v_limite_aprovado NUMERIC;
  v_total_anterior NUMERIC;
  v_disponivel_anterior NUMERIC;
  v_total_novo NUMERIC;
  v_disponivel_novo NUMERIC;
  v_variacao NUMERIC;
  v_tipo_mov TEXT;
  v_processadas INTEGER := 0;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('gsa_process_due_store_credit_releases')) THEN
    RETURN 0;
  END IF;

  PERFORM set_config('gsa.credit_release', 'on', true);

  FOR v_solicitacao IN
    SELECT *
    FROM public.loja_credito_solicitacoes
    WHERE status = 'contrato_assinado'
      AND data_liberacao_credito IS NOT NULL
      AND data_liberacao_credito <= CURRENT_DATE
    ORDER BY data_liberacao_credito, created_at, id
    FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      SELECT *
        INTO v_cliente
      FROM public.clientes
      WHERE id = v_solicitacao.cliente_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Cliente % não encontrado.', v_solicitacao.cliente_id;
      END IF;

      IF COALESCE(v_cliente.bloqueado, false)
         OR v_cliente.status IS DISTINCT FROM 'ativo'
         OR COALESCE(v_cliente.cadastro_aprovado, false) = false THEN
        RAISE EXCEPTION 'Cliente % sem acesso ativo.', v_cliente.id;
      END IF;

      v_limite_aprovado := COALESCE(v_solicitacao.limite_aprovado, 0);
      IF v_limite_aprovado <= 0 THEN
        RAISE EXCEPTION 'Solicitação % possui limite inválido.', v_solicitacao.id;
      END IF;

      v_total_anterior := COALESCE(v_cliente.limite_credito_total, 0);
      v_disponivel_anterior := COALESCE(v_cliente.limite_credito_disponivel, 0);

      IF v_solicitacao.tipo_solicitacao = 'adesao' THEN
        v_total_novo := v_limite_aprovado;
        v_disponivel_novo := v_limite_aprovado;
        v_variacao := v_limite_aprovado;
        v_tipo_mov := 'concessao_inicial';
      ELSE
        v_variacao := v_limite_aprovado - v_total_anterior;
        v_total_novo := v_limite_aprovado;
        v_disponivel_novo := v_disponivel_anterior + v_variacao;
        v_tipo_mov := 'solicitacao_aumento_aprovada';

        IF v_disponivel_novo < 0 THEN
          RAISE EXCEPTION 'Novo limite inferior ao crédito utilizado pelo cliente %.', v_cliente.id;
        END IF;
      END IF;

      UPDATE public.clientes
      SET limite_credito_total = v_total_novo,
          limite_credito_disponivel = v_disponivel_novo,
          opcao_pagamento_parcelado = v_solicitacao.opcao_pagamento_parcelado
      WHERE id = v_cliente.id;

      INSERT INTO public.loja_credito_movimentacoes (
        cliente_id,
        solicitacao_id,
        tipo,
        valor,
        limite_total_anterior,
        limite_total_novo,
        limite_disponivel_anterior,
        limite_disponivel_novo,
        descricao
      )
      SELECT
        v_cliente.id,
        v_solicitacao.id,
        v_tipo_mov,
        v_variacao,
        v_total_anterior,
        v_total_novo,
        v_disponivel_anterior,
        v_disponivel_novo,
        CASE
          WHEN v_solicitacao.tipo_solicitacao = 'adesao'
            THEN 'Ativação automática e transacional de limite aprovado'
          ELSE format('Ajuste automático e transacional do limite para %s', v_limite_aprovado)
        END
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.loja_credito_movimentacoes existente
        WHERE existente.solicitacao_id = v_solicitacao.id
          AND existente.tipo IN ('concessao_inicial', 'solicitacao_aumento_aprovada')
      );

      UPDATE public.loja_credito_solicitacoes
      SET status = 'liberado',
          updated_at = NOW()
      WHERE id = v_solicitacao.id
        AND status = 'contrato_assinado';

      IF FOUND THEN
        INSERT INTO public.notificacoes (
          cliente_id,
          destinatario_tipo,
          titulo,
          mensagem,
          modulo,
          tipo,
          lida,
          data_criacao
        ) VALUES (
          v_cliente.id,
          'cliente',
          'Crédito ativo',
          format(
            'Seu limite de crédito de R$ %s foi liberado e já está disponível.',
            to_char(v_limite_aprovado, 'FM999G999G990D00')
          ),
          'credito_loja',
          'sistema',
          false,
          NOW()
        );
        v_processadas := v_processadas + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
            RAISE
            RAISE EXCEPTION 'Erro em gsa_process_due_store_credit_releases: %', SQLERRM;
        EXCEPTION 'Erro em gsa_process_due_store_credit_releases: %', SQLERRM;
        END;
  END LOOP;

  RETURN v_processadas;
END;
$$;

-- File: 20260728040000_fix_exception_handlers.sql
-- Function: gsa_process_due_store_credit_releases
CREATE OR REPLACE FUNCTION public.gsa_process_due_store_credit_releases()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_cliente_id UUID;
  v_total INTEGER := 0;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('gsa_process_due_store_credit_releases')) THEN
    RETURN 0;
  END IF;

  FOR v_cliente_id IN
    SELECT DISTINCT cliente_id
    FROM public.loja_credito_solicitacoes
    WHERE status = 'contrato_assinado'
      AND data_liberacao_credito IS NOT NULL
      AND data_liberacao_credito <= CURRENT_DATE
      AND cliente_id IS NOT NULL
  LOOP
    BEGIN
      v_total := v_total + public.gsa_release_due_store_credit_for_client(v_cliente_id);
    EXCEPTION WHEN OTHERS THEN
            RAISE
            RAISE EXCEPTION 'Erro em gsa_process_due_store_credit_releases: %', SQLERRM;
        EXCEPTION 'Erro em gsa_process_due_store_credit_releases: %', SQLERRM;
        END;
  END LOOP;

  RETURN v_total;
END;
$$;

-- File: 20260728040000_fix_exception_handlers.sql
-- Function: gsa_public_create_enterprise_budget_v2
CREATE OR REPLACE FUNCTION public.gsa_public_create_enterprise_budget_v2(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_name text;
  v_email text;
  v_phone text;
  v_type text;
  v_request text;
  v_honeypot text;
  v_started_at timestamptz;
  v_now timestamptz := clock_timestamp();
  v_fingerprint text;
  v_protocol text;
  v_rate public.gsa_public_budget_rate_limits%ROWTYPE;
  v_metadata jsonb;
  v_sanitized jsonb;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'Dados da solicitação inválidos.' USING ERRCODE = '22023';
  END IF;

  v_name := btrim(COALESCE(p_payload->>'nome', ''));
  v_email := lower(btrim(COALESCE(p_payload->>'email', '')));
  v_phone := regexp_replace(COALESCE(p_payload->>'telefone', ''), '\D', '', 'g');
  v_type := lower(btrim(COALESCE(p_payload->>'tipo', '')));
  v_request := btrim(COALESCE(p_payload->>'solicitacao', ''));
  v_honeypot := btrim(COALESCE(p_payload->>'website', ''));
  v_metadata := CASE
    WHEN jsonb_typeof(p_payload->'metadata') = 'object' THEN p_payload->'metadata'
    ELSE '{}'::jsonb
  END;

  v_protocol := 'GSA-' || to_char(v_now AT TIME ZONE 'America/Sao_Paulo', 'YYYYMMDD') || '-' ||
    upper(substr(md5(random()::text || v_now::text), 1, 6));

  -- Robôs que preenchem o campo invisível recebem resposta neutra, sem gravar lead.
  IF v_honeypot <> '' THEN
    RETURN jsonb_build_object('success', true, 'protocol', v_protocol);
  END IF;

  IF char_length(v_name) < 2 OR char_length(v_name) > 120 THEN
    RAISE EXCEPTION 'Nome inválido.' USING ERRCODE = '22023';
  END IF;

  IF char_length(v_email) > 160 OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'E-mail inválido.' USING ERRCODE = '22023';
  END IF;

  IF char_length(v_phone) NOT BETWEEN 10 AND 11 THEN
    RAISE EXCEPTION 'Telefone inválido.' USING ERRCODE = '22023';
  END IF;

  IF v_type NOT IN ('site', 'loja', 'sistema', 'aplicativo', 'automacao', 'integracao') THEN
    RAISE EXCEPTION 'Tipo de projeto inválido.' USING ERRCODE = '22023';
  END IF;

  IF char_length(v_request) < 20 OR char_length(v_request) > 2000 THEN
    RAISE EXCEPTION 'Descrição inválida.' USING ERRCODE = '22023';
  END IF;

  BEGIN
    v_started_at := (p_payload->>'started_at')::timestamptz;
  EXCEPTION WHEN OTHERS THEN
            RAISE
            RAISE EXCEPTION 'Erro em gsa_public_create_enterprise_budget_v2: %', SQLERRM;
        EXCEPTION 'Erro em gsa_public_create_enterprise_budget_v2: %', SQLERRM;
        EXCEPTION 'Tempo de preenchimento inválido.' USING ERRCODE = '22023';
  END;

  IF v_started_at > v_now
     OR v_now - v_started_at < interval '2 seconds'
     OR v_now - v_started_at > interval '2 hours' THEN
    RAISE EXCEPTION 'Tempo de preenchimento inválido.' USING ERRCODE = '22023';
  END IF;

  -- O limite usa contato normalizado. Não depende de dados fornecidos como identificador livre.
  v_fingerprint := md5(v_email || ':' || v_phone);

  INSERT INTO public.gsa_public_budget_rate_limits (fingerprint, window_started_at, attempts, updated_at)
  VALUES (v_fingerprint, v_now, 0, v_now)
  ON CONFLICT (fingerprint) DO NOTHING;

  SELECT *
    INTO v_rate
    FROM public.gsa_public_budget_rate_limits
   WHERE fingerprint = v_fingerprint
   FOR UPDATE;

  IF v_rate.blocked_until IS NOT NULL AND v_rate.blocked_until > v_now THEN
    RAISE EXCEPTION 'Limite temporário de solicitações atingido.' USING ERRCODE = 'P0001';
  END IF;

  IF v_rate.window_started_at < v_now - interval '1 hour' THEN
    UPDATE public.gsa_public_budget_rate_limits
       SET window_started_at = v_now,
           attempts = 0,
           blocked_until = NULL,
           updated_at = v_now
     WHERE fingerprint = v_fingerprint;
    v_rate.attempts := 0;
  END IF;

  IF v_rate.attempts >= 4 THEN
    UPDATE public.gsa_public_budget_rate_limits
       SET blocked_until = v_now + interval '2 hours',
           updated_at = v_now
     WHERE fingerprint = v_fingerprint;
    RAISE EXCEPTION 'Limite temporário de solicitações atingido.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.gsa_public_budget_rate_limits
     SET attempts = attempts + 1,
         updated_at = v_now
   WHERE fingerprint = v_fingerprint;

  v_sanitized := jsonb_build_object(
    'nome', v_name,
    'email', v_email,
    'telefone', v_phone,
    'tipo', v_type,
    'solicitacao', v_request,
    'protocolo', v_protocol,
    'origem', 'public_sites_systems',
    'data_envio', v_now,
    'metadata', jsonb_build_object(
      'source', left(COALESCE(v_metadata->>'source', 'public_sites_systems'), 80),
      'page', left(COALESCE(v_metadata->>'page', ''), 300),
      'referrer', left(COALESCE(v_metadata->>'referrer', ''), 500),
      'utm_source', left(COALESCE(v_metadata->>'utm_source', ''), 120),
      'utm_medium', left(COALESCE(v_metadata->>'utm_medium', ''), 120),
      'utm_campaign', left(COALESCE(v_metadata->>'utm_campaign', ''), 160),
      'utm_content', left(COALESCE(v_metadata->>'utm_content', ''), 160)
    )
  );

  IF NOT EXISTS (
    SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = 'gsa_public_create_enterprise_budget'
  ) THEN
    RAISE EXCEPTION 'Serviço de orçamento indisponível.' USING ERRCODE = 'P0001';
  END IF;

  -- A função antiga continua responsável pela persistência, mas deixa de ser pública.
  EXECUTE 'SELECT public.gsa_public_create_enterprise_budget($1)' USING v_sanitized;

  DELETE FROM public.gsa_public_budget_rate_limits
   WHERE updated_at < v_now - interval '30 days';

  RETURN jsonb_build_object('success', true, 'protocol', v_protocol);
END;
$$;

-- File: 20260728040000_fix_exception_handlers.sql
-- Function: gsa_login_colaborador
CREATE OR REPLACE FUNCTION public.gsa_login_colaborador(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_code text := trim(COALESCE(p_code, ''));
  v_collaborator_id uuid;
  v_internal_code text;
  v_status text;
  v_result jsonb;
BEGIN
  IF length(v_code) < 6 OR length(v_code) > 128 THEN
    RETURN jsonb_build_object('valid', false, 'success', false, 'error', 'invalid_credentials');
  END IF;

  SELECT c.id, c.credencial_acesso, lower(COALESCE(c.status, 'ativo'))
    INTO v_collaborator_id, v_internal_code, v_status
    FROM public.colaboradores c
   WHERE c.credencial_hash IS NOT NULL
     AND crypt(v_code, c.credencial_hash) = c.credencial_hash
   LIMIT 1;

  IF v_collaborator_id IS NULL
     OR v_status IN ('suspenso', 'bloqueado', 'inativo', 'excluido', 'excluído', 'cancelado') THEN
    RETURN jsonb_build_object('valid', false, 'success', false, 'error', 'invalid_credentials');
  END IF;

  EXECUTE 'SELECT public.gsa_login_colaborador_legacy($1)::jsonb'
     INTO v_result
     USING v_internal_code;

  IF v_result IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'success', false, 'error', 'authentication_failed');
  END IF;

  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
            RAISE
            RAISE EXCEPTION 'Erro em gsa_login_colaborador: %', SQLERRM;
        EXCEPTION 'Erro em gsa_login_colaborador: %', SQLERRM;
        END;
$$;

-- File: 20260728040000_fix_exception_handlers.sql
-- Function: gsa_admin_validate_context
CREATE OR REPLACE FUNCTION public.gsa_admin_validate_context(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_context jsonb := public.gsa_admin_context();
  v_session jsonb;
  v_stored_token text;
  v_token_valid boolean := false;
  v_legacy_validation jsonb;
BEGIN
  IF p_sessao_id IS NOT NULL
     AND p_sessao_id::text <> COALESCE(v_context ->> 'session_id', '') THEN
    RAISE EXCEPTION 'A sessão informada não corresponde ao JWT atual.' USING ERRCODE = '42501';
  END IF;

  IF p_sessao_id IS NULL AND p_session_token IS NULL THEN
    RETURN v_context;
  END IF;

  IF p_sessao_id IS NULL OR COALESCE(p_session_token, '') = '' THEN
    RAISE EXCEPTION 'Identificação completa da sessão é obrigatória.' USING ERRCODE = '42501';
  END IF;

  SELECT to_jsonb(s)
    INTO v_session
    FROM public.sistema_sessoes s
   WHERE s.id = p_sessao_id
   LIMIT 1;

  IF v_session IS NULL THEN
    RAISE EXCEPTION 'Sessão administrativa revogada.' USING ERRCODE = '42501';
  END IF;

  v_stored_token := COALESCE(
    v_session ->> 'session_token',
    v_session ->> 'sessao_token',
    v_session ->> 'token',
    v_session ->> 'session_token_hash',
    v_session ->> 'token_hash',
    ''
  );

  IF v_stored_token <> '' THEN
    v_token_valid := v_stored_token = p_session_token;

    IF NOT v_token_valid AND v_stored_token LIKE '$2%' THEN
      BEGIN
        v_token_valid := crypt(p_session_token, v_stored_token) = v_stored_token;
      EXCEPTION WHEN OTHERS THEN
            RAISE
            RAISE EXCEPTION 'Erro em gsa_admin_validate_context: %', SQLERRM;
        EXCEPTION 'Erro em gsa_admin_validate_context: %', SQLERRM;
        END;
    END IF;

    IF NOT v_token_valid AND v_stored_token ~ '^[0-9a-fA-F]{64}$' THEN
      v_token_valid := lower(v_stored_token) = encode(digest(p_session_token, 'sha256'), 'hex');
    END IF;
  ELSE
    -- Compatibilidade apenas para instalações cujo segredo não está exposto na
    -- linha da sessão. Aceitamos somente respostas positivas explícitas.
    BEGIN
      EXECUTE
        'SELECT to_jsonb(v) FROM public.gsa_validate_session($1, $2) v LIMIT 1'
        INTO v_legacy_validation
        USING p_sessao_id, p_session_token;

      v_token_valid := lower(COALESCE(
        v_legacy_validation ->> 'is_valid',
        v_legacy_validation ->> 'valid',
        v_legacy_validation ->> 'success',
        'false'
      )) IN ('true', 't', '1');
    EXCEPTION WHEN undefined_function THEN
      v_token_valid := false;
    END;
  END IF;

  IF NOT v_token_valid THEN
    RAISE EXCEPTION 'Sessão administrativa inválida ou expirada.' USING ERRCODE = '42501';
  END IF;

  RETURN v_context;
END;
$$;

-- File: 20260728040000_fix_exception_handlers.sql
-- Function: gsa_public_create_enterprise_budget_v2
CREATE OR REPLACE FUNCTION public.gsa_public_create_enterprise_budget_v2(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_name text;
  v_email text;
  v_phone text;
  v_type text;
  v_request text;
  v_honeypot text;
  v_started_at timestamptz;
  v_now timestamptz := clock_timestamp();
  v_fingerprint text;
  v_decoy_protocol text;
  v_rate public.gsa_public_budget_rate_limits%ROWTYPE;
  v_metadata jsonb;
  v_sanitized jsonb;
  v_internal jsonb;
  v_persisted_protocol text;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'Dados da solicitacao invalidos.' USING ERRCODE = '22023';
  END IF;

  v_name := btrim(COALESCE(p_payload->>'nome', ''));
  v_email := lower(btrim(COALESCE(p_payload->>'email', '')));
  v_phone := regexp_replace(COALESCE(p_payload->>'telefone', ''), '\D', '', 'g');
  v_type := lower(btrim(COALESCE(p_payload->>'tipo', '')));
  v_request := btrim(COALESCE(p_payload->>'solicitacao', ''));
  v_honeypot := btrim(COALESCE(p_payload->>'website', ''));
  v_metadata := CASE
    WHEN jsonb_typeof(p_payload->'metadata') = 'object' THEN p_payload->'metadata'
    ELSE '{}'::jsonb
  END;

  v_decoy_protocol := 'GSA-' || to_char(v_now AT TIME ZONE 'America/Sao_Paulo', 'YYYYMMDD') || '-' ||
    upper(substr(md5(random()::text || v_now::text), 1, 6));

  -- Robos recebem resposta neutra, sem gravar lead.
  IF v_honeypot <> '' THEN
    RETURN jsonb_build_object('success', true, 'protocol', v_decoy_protocol);
  END IF;

  IF char_length(v_name) < 2 OR char_length(v_name) > 120 THEN
    RAISE EXCEPTION 'Nome invalido.' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_email) > 160 OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'E-mail invalido.' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_phone) NOT BETWEEN 10 AND 11 THEN
    RAISE EXCEPTION 'Telefone invalido.' USING ERRCODE = '22023';
  END IF;
  IF v_type NOT IN ('site', 'loja', 'sistema', 'aplicativo', 'automacao', 'integracao') THEN
    RAISE EXCEPTION 'Tipo de projeto invalido.' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_request) < 20 OR char_length(v_request) > 2000 THEN
    RAISE EXCEPTION 'Descricao invalida.' USING ERRCODE = '22023';
  END IF;

  BEGIN
    v_started_at := (p_payload->>'started_at')::timestamptz;
  EXCEPTION WHEN OTHERS THEN
            RAISE
            RAISE EXCEPTION 'Erro em gsa_public_create_enterprise_budget_v2: %', SQLERRM;
        EXCEPTION 'Erro em gsa_public_create_enterprise_budget_v2: %', SQLERRM;
        EXCEPTION 'Tempo de preenchimento invalido.' USING ERRCODE = '22023';
  END;

  IF v_started_at > v_now
     OR v_now - v_started_at < interval '2 seconds'
     OR v_now - v_started_at > interval '2 hours' THEN
    RAISE EXCEPTION 'Tempo de preenchimento invalido.' USING ERRCODE = '22023';
  END IF;

  v_fingerprint := md5(v_email || ':' || v_phone);
  INSERT INTO public.gsa_public_budget_rate_limits(
    fingerprint, window_started_at, attempts, updated_at
  ) VALUES (
    v_fingerprint, v_now, 0, v_now
  ) ON CONFLICT (fingerprint) DO NOTHING;

  SELECT * INTO v_rate
  FROM public.gsa_public_budget_rate_limits
  WHERE fingerprint = v_fingerprint
  FOR UPDATE;

  IF v_rate.blocked_until IS NOT NULL AND v_rate.blocked_until > v_now THEN
    RAISE EXCEPTION 'Limite temporario de solicitacoes atingido.' USING ERRCODE = 'P0001';
  END IF;

  IF v_rate.window_started_at < v_now - interval '1 hour' THEN
    UPDATE public.gsa_public_budget_rate_limits
    SET window_started_at = v_now,
        attempts = 0,
        blocked_until = NULL,
        updated_at = v_now
    WHERE fingerprint = v_fingerprint;
    v_rate.attempts := 0;
  END IF;

  IF v_rate.attempts >= 4 THEN
    UPDATE public.gsa_public_budget_rate_limits
    SET blocked_until = v_now + interval '2 hours',
        updated_at = v_now
    WHERE fingerprint = v_fingerprint;
    RAISE EXCEPTION 'Limite temporario de solicitacoes atingido.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.gsa_public_budget_rate_limits
  SET attempts = attempts + 1,
      updated_at = v_now
  WHERE fingerprint = v_fingerprint;

  v_sanitized := jsonb_build_object(
    'nome', v_name,
    'email', v_email,
    'telefone', v_phone,
    'tipo', v_type,
    'solicitacao', v_request,
    'origem', 'public_sites_systems',
    'data_envio', v_now,
    'metadata', jsonb_build_object(
      'source', left(COALESCE(v_metadata->>'source', 'public_sites_systems'), 80),
      'page', left(COALESCE(v_metadata->>'page', ''), 300),
      'referrer', left(COALESCE(v_metadata->>'referrer', ''), 500),
      'utm_source', left(COALESCE(v_metadata->>'utm_source', ''), 120),
      'utm_medium', left(COALESCE(v_metadata->>'utm_medium', ''), 120),
      'utm_campaign', left(COALESCE(v_metadata->>'utm_campaign', ''), 160),
      'utm_content', left(COALESCE(v_metadata->>'utm_content', ''), 160)
    )
  );

  SELECT public.gsa_public_create_enterprise_budget(v_sanitized) INTO v_internal;
  v_persisted_protocol := nullif(v_internal->>'codigo_orcamento', '');
  IF NOT coalesce((v_internal->>'success')::boolean, false) OR v_persisted_protocol IS NULL THEN
    RAISE EXCEPTION 'Servico de orcamento indisponivel.' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM public.gsa_public_budget_rate_limits
  WHERE updated_at < v_now - interval '30 days';

  RETURN jsonb_build_object(
    'success', true,
    'protocol', v_persisted_protocol,
    'budget_id', v_internal->>'orcamento_id',
    'already_exists', coalesce((v_internal->>'already_exists')::boolean, false)
  );
END;
$$;

-- File: 20260728040000_fix_exception_handlers.sql
-- Function: gsa_admin_request_classified_adjustments
CREATE OR REPLACE FUNCTION public.gsa_admin_request_classified_adjustments(
  p_anuncio_id uuid,
  p_campos jsonb,
  p_observacao text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_context jsonb;
  v_actor_id uuid;
  v_item jsonb;
  v_field text;
  v_adjustment_id uuid;
BEGIN
  v_context := public.gsa_admin_context();
  IF COALESCE(v_context ->> 'actor_type', '') NOT IN ('admin','colaborador') THEN
    RAISE EXCEPTION 'Sessão administrativa obrigatória.' USING ERRCODE='42501';
  END IF;
  IF (v_context ->> 'actor_type') = 'colaborador'
     AND NOT COALESCE(public.gsa_admin_has_module('classificados'), false) THEN
    RAISE EXCEPTION 'Sem permissão para solicitar ajustes.' USING ERRCODE='42501';
  END IF;

  IF p_campos IS NULL OR jsonb_typeof(p_campos) <> 'array' OR jsonb_array_length(p_campos) = 0 THEN
    RAISE EXCEPTION 'Selecione pelo menos um campo para ajuste.' USING ERRCODE='22023';
  END IF;
  IF length(trim(COALESCE(p_observacao,''))) < 5 THEN
    RAISE EXCEPTION 'Informe uma orientação clara para o anunciante.' USING ERRCODE='22023';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_campos)
  LOOP
    v_field := trim(BOTH '"' FROM v_item::text);
    IF v_field = '' OR length(v_field) > 100 THEN
      RAISE EXCEPTION 'Campo de ajuste inválido.' USING ERRCODE='22023';
    END IF;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM public.classificados_anuncios WHERE id=p_anuncio_id) THEN
    RAISE EXCEPTION 'Anúncio não encontrado.' USING ERRCODE='P0002';
  END IF;

  BEGIN
    v_actor_id := NULLIF(v_context->>'actor_id','')::uuid;
  EXCEPTION WHEN OTHERS THEN
            RAISE
            RAISE EXCEPTION 'Erro em gsa_admin_request_classified_adjustments: %', SQLERRM;
        EXCEPTION 'Erro em gsa_admin_request_classified_adjustments: %', SQLERRM;
        END;

  UPDATE public.classificados_ajustes
  SET status='cancelado', resolvido_at=now()
  WHERE anuncio_id=p_anuncio_id AND status='pendente';

  INSERT INTO public.classificados_ajustes(anuncio_id, campos, observacao, status, solicitado_por)
  VALUES (p_anuncio_id, p_campos, trim(p_observacao), 'pendente', v_actor_id)
  RETURNING id INTO v_adjustment_id;

  UPDATE public.classificados_anuncios
  SET status='ajustes_solicitados', updated_at=now()
  WHERE id=p_anuncio_id;

  RETURN jsonb_build_object('success',true,'ajuste_id',v_adjustment_id,'status','ajustes_solicitados');
END;
$$;

-- File: 20260728040000_fix_exception_handlers.sql
-- Function: gsa_public_submit_career_application
CREATE OR REPLACE FUNCTION public.gsa_public_submit_career_application(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_protocol text;
  v_app_id uuid;
  v_doc text;
  v_name text;
  v_email text;
  v_phone text;
  v_area text;
  v_type text;
  v_salary numeric(12,2);
  v_resume text;
  v_linkedin text;
  v_notes text;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'Payload invalido' USING ERRCODE = '22023';
  END IF;

  v_name := trim(COALESCE(p_payload->>'candidate_name', ''));
  v_doc := regexp_replace(COALESCE(p_payload->>'document', ''), '[^0-9]', '', 'g');
  v_email := lower(trim(COALESCE(p_payload->>'email', '')));
  v_phone := regexp_replace(COALESCE(p_payload->>'phone', ''), '[^0-9]', '', 'g');
  v_area := trim(COALESCE(p_payload->>'desired_area', 'Geral'));
  v_type := lower(trim(COALESCE(p_payload->>'employment_type', 'clt')));
  v_resume := nullif(trim(COALESCE(p_payload->>'resume_url', '')), '');
  v_linkedin := nullif(trim(COALESCE(p_payload->>'linkedin_url', '')), '');
  v_notes := nullif(trim(COALESCE(p_payload->>'notes', '')), '');

  IF p_payload->>'salary_expectation' IS NOT NULL AND p_payload->>'salary_expectation' <> '' THEN
    BEGIN
      v_salary := (p_payload->>'salary_expectation')::numeric;
    EXCEPTION WHEN OTHERS THEN
            RAISE
            RAISE EXCEPTION 'Erro em gsa_public_submit_career_application: %', SQLERRM;
        EXCEPTION 'Erro em gsa_public_submit_career_application: %', SQLERRM;
        END;
  END IF;

  IF length(v_name) < 2 OR length(v_doc) < 11 OR v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(v_phone) < 10 THEN
    RAISE EXCEPTION 'Dados obrigatorios invalidos' USING ERRCODE = '22023';
  END IF;

  IF v_type NOT IN ('clt', 'estagio') THEN
    v_type := 'clt';
  END IF;

  v_protocol := 'RH-' || to_char(current_date, 'YYYYMMDD') || '-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 8));

  INSERT INTO public.gsa_careers_applications (
    protocol, candidate_name, document, email, phone, desired_area,
    employment_type, salary_expectation, resume_url, linkedin_url, notes
  ) VALUES (
    v_protocol, v_name, v_doc, v_email, v_phone, v_area,
    v_type, v_salary, v_resume, v_linkedin, v_notes
  ) RETURNING id INTO v_app_id;

  RETURN jsonb_build_object(
    'success', true,
    'protocol', v_protocol,
    'id', v_app_id
  );
END;
$$;

-- File: 20260728040000_fix_exception_handlers.sql
-- Function: gsa_public_submit_career_application
CREATE OR REPLACE FUNCTION public.gsa_public_submit_career_application(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_application_id uuid := gen_random_uuid();
  v_protocol text;
  v_existing public.gsa_careers_applications%ROWTYPE;
  v_document text;
  v_name text;
  v_email text;
  v_phone text;
  v_area text;
  v_type text;
  v_salary numeric(12,2);
  v_linkedin text;
  v_notes text;
  v_resume_name text;
  v_resume_mime text;
  v_resume_size bigint;
  v_resume_path text;
  v_safe_name text;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'Payload invalido' USING ERRCODE = '22023';
  END IF;

  v_name := trim(COALESCE(p_payload->>'candidate_name', ''));
  v_document := regexp_replace(COALESCE(p_payload->>'document', ''), '[^0-9]', '', 'g');
  v_email := lower(trim(COALESCE(p_payload->>'email', '')));
  v_phone := regexp_replace(COALESCE(p_payload->>'phone', ''), '[^0-9]', '', 'g');
  v_area := trim(COALESCE(p_payload->>'desired_area', ''));
  v_type := lower(trim(COALESCE(p_payload->>'employment_type', '')));
  v_linkedin := nullif(trim(COALESCE(p_payload->>'linkedin_url', '')), '');
  v_notes := nullif(trim(COALESCE(p_payload->>'notes', '')), '');
  v_resume_name := nullif(trim(COALESCE(p_payload->>'resume_file_name', '')), '');
  v_resume_mime := lower(nullif(trim(COALESCE(p_payload->>'resume_mime_type', '')), ''));
  v_resume_size := NULLIF(COALESCE(p_payload->>'resume_size', ''), '')::bigint;

  IF length(v_name) < 3 OR length(v_name) > 160 THEN
    RAISE EXCEPTION 'Nome completo invalido' USING ERRCODE = '22023';
  END IF;
  IF NOT public.gsa_careers_validate_cpf(v_document) THEN
    RAISE EXCEPTION 'CPF invalido' USING ERRCODE = '22023';
  END IF;
  IF v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(v_email) > 200 THEN
    RAISE EXCEPTION 'Email invalido' USING ERRCODE = '22023';
  END IF;
  IF length(v_phone) NOT BETWEEN 10 AND 13 THEN
    RAISE EXCEPTION 'Telefone invalido' USING ERRCODE = '22023';
  END IF;
  IF v_area NOT IN (
    'Comercial & Vendas',
    'Tecnologia & Desenvolvimento',
    'Operações & Logística',
    'Suporte & Relacionamento',
    'Financeiro & Administração'
  ) THEN
    RAISE EXCEPTION 'Area de interesse invalida' USING ERRCODE = '22023';
  END IF;
  IF v_type NOT IN ('clt', 'estagio') THEN
    RAISE EXCEPTION 'Modalidade invalida' USING ERRCODE = '22023';
  END IF;
  IF v_linkedin IS NOT NULL AND v_linkedin !~* '^https?://' THEN
    RAISE EXCEPTION 'URL do LinkedIn invalida' USING ERRCODE = '22023';
  END IF;
  IF length(COALESCE(v_notes, '')) > 4000 THEN
    RAISE EXCEPTION 'Mensagem muito extensa' USING ERRCODE = '22023';
  END IF;

  IF NULLIF(COALESCE(p_payload->>'salary_expectation', ''), '') IS NOT NULL THEN
    BEGIN
      v_salary := (p_payload->>'salary_expectation')::numeric;
    EXCEPTION WHEN OTHERS THEN
            RAISE
            RAISE EXCEPTION 'Erro em gsa_public_submit_career_application: %', SQLERRM;
        EXCEPTION 'Erro em gsa_public_submit_career_application: %', SQLERRM;
        EXCEPTION 'Pretensao salarial invalida' USING ERRCODE = '22023';
    END;
    IF v_salary < 0 OR v_salary > 99999999.99 THEN
      RAISE EXCEPTION 'Pretensao salarial fora do limite' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF v_resume_name IS NOT NULL THEN
    IF v_resume_size IS NULL OR v_resume_size <= 0 OR v_resume_size > 10485760 THEN
      RAISE EXCEPTION 'Curriculo deve possuir no maximo 10 MB' USING ERRCODE = '22023';
    END IF;
    IF v_resume_mime NOT IN (
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/webp'
    ) THEN
      RAISE EXCEPTION 'Formato de curriculo nao permitido' USING ERRCODE = '22023';
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_document || '|' || lower(v_area), 0));

  SELECT *
  INTO v_existing
  FROM public.gsa_careers_applications
  WHERE document = v_document
    AND lower(desired_area) = lower(v_area)
    AND status IN ('received', 'under_review', 'interview_scheduled', 'approved', 'talent_pool')
    AND created_at >= now() - interval '180 days'
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_exists', true,
      'protocol', v_existing.protocol,
      'id', v_existing.id,
      'resume_upload_path', CASE
        WHEN v_resume_name IS NOT NULL AND v_existing.resume_uploaded_at IS NULL
          THEN v_existing.resume_storage_path
        ELSE NULL
      END
    );
  END IF;

  IF v_resume_name IS NOT NULL THEN
    v_safe_name := regexp_replace(
      regexp_replace(lower(v_resume_name), '[^a-z0-9._-]+', '_', 'g'),
      '^[_\.]+|[_\.]+$', '', 'g'
    );
    IF v_safe_name = '' THEN v_safe_name := 'curriculo'; END IF;
    v_safe_name := right(v_safe_name, 120);
    v_resume_path := 'applications/' || v_application_id::text || '/' ||
      encode(gen_random_bytes(16), 'hex') || '-' || v_safe_name;
  END IF;

  v_protocol := 'RH-' || to_char(current_date, 'YYYYMMDD') || '-' ||
    upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 10));

  INSERT INTO public.gsa_careers_applications (
    id,
    protocol,
    candidate_name,
    document,
    email,
    phone,
    desired_area,
    employment_type,
    salary_expectation,
    resume_url,
    resume_storage_path,
    linkedin_url,
    notes,
    status,
    public_message,
    status_changed_at
  ) VALUES (
    v_application_id,
    v_protocol,
    v_name,
    v_document,
    v_email,
    v_phone,
    v_area,
    v_type,
    v_salary,
    NULL,
    v_resume_path,
    v_linkedin,
    v_notes,
    'received',
    'Candidatura recebida. A equipe de Recursos Humanos fará a análise inicial do perfil.',
    now()
  );

  INSERT INTO public.gsa_careers_application_history (
    application_id, from_status, to_status, actor_type, actor_name, note
  ) VALUES (
    v_application_id, NULL, 'received', 'candidate', v_name, 'Candidatura enviada pelo portal público.'
  );

  RETURN jsonb_build_object(
    'success', true,
    'already_exists', false,
    'protocol', v_protocol,
    'id', v_application_id,
    'resume_upload_path', v_resume_path
  );
END;
$$;

-- File: 20260728040000_fix_exception_handlers.sql
-- Function: gsa_admin_update_career_application
CREATE OR REPLACE FUNCTION public.gsa_admin_update_career_application(
  p_sessao_id uuid,
  p_session_token text,
  p_application_id uuid,
  p_status text,
  p_internal_notes text DEFAULT NULL,
  p_interview_at timestamptz DEFAULT NULL,
  p_interview_location text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_context jsonb;
  v_application public.gsa_careers_applications%ROWTYPE;
  v_new_status text := lower(trim(COALESCE(p_status, '')));
  v_actor_type text;
  v_actor_id uuid;
  v_actor_name text;
  v_public_message text;
BEGIN
  v_context := public.gsa_careers_admin_context(p_sessao_id, p_session_token);
  v_actor_type := COALESCE(v_context->>'actor_type', v_context->>'ator_tipo');
  v_actor_name := COALESCE(v_context->>'actor_name', v_context->>'ator_nome', 'Administrador');
  BEGIN
    v_actor_id := COALESCE(v_context->>'actor_id', v_context->>'ator_id')::uuid;
  EXCEPTION WHEN OTHERS THEN
            RAISE
            RAISE EXCEPTION 'Erro em gsa_admin_update_career_application: %', SQLERRM;
        EXCEPTION 'Erro em gsa_admin_update_career_application: %', SQLERRM;
        END;

  IF v_new_status NOT IN ('received', 'under_review', 'interview_scheduled', 'approved', 'talent_pool', 'rejected') THEN
    RAISE EXCEPTION 'Status invalido' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_application
  FROM public.gsa_careers_applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Candidatura nao encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF v_new_status <> v_application.status AND NOT (
    (v_application.status = 'received' AND v_new_status IN ('under_review', 'talent_pool', 'rejected')) OR
    (v_application.status = 'under_review' AND v_new_status IN ('interview_scheduled', 'approved', 'talent_pool', 'rejected')) OR
    (v_application.status = 'interview_scheduled' AND v_new_status IN ('under_review', 'approved', 'talent_pool', 'rejected')) OR
    (v_application.status = 'talent_pool' AND v_new_status IN ('under_review', 'interview_scheduled', 'rejected')) OR
    (v_application.status = 'rejected' AND v_new_status = 'under_review') OR
    (v_application.status = 'approved' AND v_new_status = 'under_review')
  ) THEN
    RAISE EXCEPTION 'Transicao de status nao permitida: % para %', v_application.status, v_new_status
      USING ERRCODE = '22023';
  END IF;

  IF v_new_status = 'interview_scheduled' THEN
    IF p_interview_at IS NULL OR trim(COALESCE(p_interview_location, '')) = '' THEN
      RAISE EXCEPTION 'Data e local/link da entrevista sao obrigatorios' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF v_new_status = 'rejected' AND trim(COALESCE(p_internal_notes, '')) = '' THEN
    RAISE EXCEPTION 'O motivo interno do encerramento e obrigatorio' USING ERRCODE = '22023';
  END IF;

  v_public_message := CASE v_new_status
    WHEN 'received' THEN 'Candidatura recebida. A equipe de Recursos Humanos fará a análise inicial do perfil.'
    WHEN 'under_review' THEN 'Seu perfil está em análise pela equipe de Recursos Humanos.'
    WHEN 'interview_scheduled' THEN 'Você avançou para a etapa de entrevista. Consulte os dados de agendamento abaixo.'
    WHEN 'approved' THEN 'Você foi aprovado no processo seletivo. A equipe de Recursos Humanos entrará em contato para os próximos procedimentos.'
    WHEN 'talent_pool' THEN 'Seu perfil foi incluído em nosso Banco de Talentos para futuras oportunidades compatíveis.'
    WHEN 'rejected' THEN 'Este processo seletivo foi encerrado. Agradecemos seu interesse em fazer parte do Grupo GSA.'
  END;

  UPDATE public.gsa_careers_applications
  SET status = v_new_status,
      internal_notes = nullif(trim(COALESCE(p_internal_notes, '')), ''),
      public_message = v_public_message,
      interview_at = CASE WHEN v_new_status = 'interview_scheduled' THEN p_interview_at ELSE interview_at END,
      interview_location = CASE WHEN v_new_status = 'interview_scheduled' THEN trim(p_interview_location) ELSE interview_location END,
      status_changed_at = CASE WHEN v_new_status <> v_application.status THEN now() ELSE status_changed_at END,
      closed_at = CASE WHEN v_new_status IN ('approved', 'rejected') THEN now() ELSE NULL END,
      updated_at = now()
  WHERE id = p_application_id;

  IF v_new_status <> v_application.status THEN
    INSERT INTO public.gsa_careers_application_history (
      application_id,
      from_status,
      to_status,
      actor_type,
      actor_id,
      actor_name,
      note,
      interview_at,
      interview_location
    ) VALUES (
      p_application_id,
      v_application.status,
      v_new_status,
      v_actor_type,
      v_actor_id,
      v_actor_name,
      nullif(trim(COALESCE(p_internal_notes, '')), ''),
      CASE WHEN v_new_status = 'interview_scheduled' THEN p_interview_at ELSE NULL END,
      CASE WHEN v_new_status = 'interview_scheduled' THEN trim(p_interview_location) ELSE NULL END
    );
  END IF;

  RETURN public.gsa_admin_get_career_application(
    p_sessao_id,
    p_session_token,
    p_application_id
  );
END;
$$;

-- File: 20260728040000_fix_exception_handlers.sql
-- Function: sync_cliente_pontos_e_saldo
CREATE OR REPLACE FUNCTION public.sync_cliente_pontos_e_saldo(
    p_cliente_id UUID,
    p_pontos_delta INT DEFAULT 0,
    p_saldo_delta NUMERIC DEFAULT 0,
    p_descricao TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_novo_saldo NUMERIC;
    v_novos_pontos INT;
BEGIN
    UPDATE public.clientes
    SET 
        saldo_carteira = COALESCE(saldo_carteira, 0) + p_saldo_delta,
        saldo_pontos = COALESCE(saldo_pontos, 0) + p_pontos_delta,
        updated_at = NOW()
    WHERE id = p_cliente_id
    RETURNING saldo_carteira, saldo_pontos INTO v_novo_saldo, v_novos_pontos;

    IF p_pontos_delta <> 0 THEN
        INSERT INTO public.points_transactions (cliente_id, tipo, pontos, descricao, created_at)
        VALUES (p_cliente_id, CASE WHEN p_pontos_delta > 0 THEN 'credito' ELSE 'debito' END, p_pontos_delta, p_descricao, NOW());
        
        INSERT INTO public.pontos_movimentacoes (cliente_id, tipo, pontos, descricao, created_at)
        VALUES (p_cliente_id, CASE WHEN p_pontos_delta > 0 THEN 'credito' ELSE 'debito' END, p_pontos_delta, p_descricao, NOW());
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'novo_saldo', v_novo_saldo,
        'novos_pontos', v_novos_pontos
    );
EXCEPTION WHEN OTHERS THEN
            RAISE
            RAISE EXCEPTION 'Erro em sync_cliente_pontos_e_saldo: %', SQLERRM;
        EXCEPTION 'Erro em sync_cliente_pontos_e_saldo: %', SQLERRM;
        END;
$$;

-- File: 20260728040000_fix_exception_handlers.sql
-- Function: gsa_admin_create_calculator_pro_voucher
CREATE OR REPLACE FUNCTION public.gsa_admin_create_calculator_pro_voucher(
  p_sessao_id uuid,
  p_session_token text,
  p_tool_id text,
  p_expires_at timestamptz DEFAULT NULL,
  p_observacoes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_code text;
  v_id uuid;
  v_actor uuid;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  IF p_tool_id IS NOT NULL AND p_tool_id NOT IN ('termination','retirement','vacation') THEN
    RAISE EXCEPTION 'Calculadora inválida' USING ERRCODE = '22023';
  END IF;
  IF p_expires_at IS NOT NULL AND p_expires_at <= now() THEN
    RAISE EXCEPTION 'A validade precisa estar no futuro' USING ERRCODE = '22023';
  END IF;

  v_code := 'GSA-PRO-' || upper(encode(gen_random_bytes(5), 'hex'));
  BEGIN
    SELECT public.gsa_current_actor_id() INTO v_actor;
  EXCEPTION WHEN OTHERS THEN
            RAISE
            RAISE EXCEPTION 'Erro em gsa_admin_create_calculator_pro_voucher: %', SQLERRM;
        EXCEPTION 'Erro em gsa_admin_create_calculator_pro_voucher: %', SQLERRM;
        END;

  INSERT INTO public.gsa_calculator_pro_vouchers (
    code_hash, code_hint, tool_id, expires_at, observacoes, created_by
  ) VALUES (
    encode(digest(upper(v_code), 'sha256'), 'hex'),
    right(v_code, 6),
    p_tool_id,
    p_expires_at,
    nullif(btrim(p_observacoes), ''),
    v_actor
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'id', v_id, 'code', v_code);
END;
$$;

-- File: 20260728040000_fix_exception_handlers.sql
-- Function: gsa_admin_grant_calculator_pro
CREATE OR REPLACE FUNCTION public.gsa_admin_grant_calculator_pro(
  p_sessao_id uuid,
  p_session_token text,
  p_cliente_id uuid,
  p_tool_id text,
  p_valid_until timestamptz,
  p_observacoes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_actor uuid;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  IF p_tool_id NOT IN ('termination','retirement','vacation') THEN RAISE EXCEPTION 'Calculadora inválida'; END IF;
  IF p_valid_until IS NULL OR p_valid_until <= now() THEN RAISE EXCEPTION 'A validade precisa estar no futuro'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clientes WHERE id = p_cliente_id) THEN RAISE EXCEPTION 'Cliente não encontrado'; END IF;
  BEGIN SELECT public.gsa_current_actor_id() INTO v_actor; EXCEPTION WHEN OTHERS THEN
            RAISE
            RAISE EXCEPTION 'Erro em gsa_admin_grant_calculator_pro: %', SQLERRM;
        EXCEPTION 'Erro em gsa_admin_grant_calculator_pro: %', SQLERRM;
        END;

  INSERT INTO public.gsa_calculator_pro_grants (
    tool_id, source, cliente_id, valid_until, observacoes, created_by
  ) VALUES (
    p_tool_id, 'manual', p_cliente_id, p_valid_until, nullif(btrim(p_observacoes), ''), v_actor
  ) RETURNING id INTO v_id;

  INSERT INTO public.gsa_calculator_pro_events(event_type, tool_id, grant_id, cliente_id, details)
  VALUES ('manual_grant_created', p_tool_id, v_id, p_cliente_id, jsonb_build_object('valid_until', p_valid_until));

  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;

-- File: 20260728040000_fix_exception_handlers.sql
-- Function: gsa_admin_save_calculator_pro_runtime_config
CREATE OR REPLACE FUNCTION public.gsa_admin_save_calculator_pro_runtime_config(
  p_sessao_id uuid,
  p_session_token text,
  p_infinitepay_handle text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_handle text;
  v_actor uuid;
  v_result jsonb;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);

  v_handle := nullif(regexp_replace(btrim(COALESCE(p_infinitepay_handle, '')), '^\$', ''), '');
  IF v_handle IS NOT NULL AND v_handle !~ '^[A-Za-z0-9._-]{2,100}$' THEN
    RAISE EXCEPTION 'InfiniteTag inválida. Informe apenas o nome, sem o símbolo $' USING ERRCODE = '22023';
  END IF;

  BEGIN
    SELECT public.gsa_current_actor_id() INTO v_actor;
  EXCEPTION WHEN OTHERS THEN
            RAISE
            RAISE EXCEPTION 'Erro em gsa_admin_save_calculator_pro_runtime_config: %', SQLERRM;
        EXCEPTION 'Erro em gsa_admin_save_calculator_pro_runtime_config: %', SQLERRM;
        END;

  INSERT INTO public.gsa_calculator_pro_runtime_config(
    config_key,
    infinitepay_handle,
    updated_by
  ) VALUES (
    'default',
    v_handle,
    v_actor
  )
  ON CONFLICT (config_key) DO UPDATE
    SET infinitepay_handle = EXCLUDED.infinitepay_handle,
        updated_by = EXCLUDED.updated_by
  RETURNING jsonb_build_object(
    'success', true,
    'infinitepay_handle', infinitepay_handle,
    'checkout_ready', infinitepay_handle IS NOT NULL,
    'updated_at', updated_at
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- File: 20260728040000_fix_exception_handlers.sql
-- Function: gsa_admin_create_calculator_pro_voucher
CREATE OR REPLACE FUNCTION public.gsa_admin_create_calculator_pro_voucher(
  p_sessao_id uuid,
  p_session_token text,
  p_tool_id text,
  p_expires_at timestamptz DEFAULT NULL,
  p_observacoes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_code text;
  v_id uuid;
  v_actor uuid;
  v_attempt integer;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);

  IF p_tool_id IS NOT NULL AND p_tool_id NOT IN ('termination','retirement','vacation') THEN
    RAISE EXCEPTION 'Calculadora inválida' USING ERRCODE = '22023';
  END IF;
  IF p_expires_at IS NOT NULL AND p_expires_at <= now() THEN
    RAISE EXCEPTION 'A validade precisa estar no futuro' USING ERRCODE = '22023';
  END IF;

  BEGIN
    SELECT public.gsa_current_actor_id() INTO v_actor;
  EXCEPTION WHEN OTHERS THEN
            RAISE
            RAISE EXCEPTION 'Erro em gsa_admin_create_calculator_pro_voucher: %', SQLERRM;
        EXCEPTION 'Erro em gsa_admin_create_calculator_pro_voucher: %', SQLERRM;
        END;

  FOR v_attempt IN 1..5 LOOP
    v_code := 'GSA-PRO-' || upper(encode(gen_random_bytes(10), 'hex'));
    BEGIN
      INSERT INTO public.gsa_calculator_pro_vouchers(
        code_hash,
        code_hint,
        tool_id,
        expires_at,
        observacoes,
        created_by
      ) VALUES (
        encode(digest(upper(v_code), 'sha256'), 'hex'),
        right(v_code, 6),
        p_tool_id,
        p_expires_at,
        nullif(btrim(p_observacoes), ''),
        v_actor
      ) RETURNING id INTO v_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempt = 5 THEN
        RAISE;
      END IF;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_id,
    'code', v_code
  );
END;
$$;

-- File: 20260728040000_fix_exception_handlers.sql
-- Function: gsa_admin_create_calculator_pro_voucher
CREATE OR REPLACE FUNCTION public.gsa_admin_create_calculator_pro_voucher(
  p_sessao_id uuid,
  p_session_token text,
  p_tool_id text,
  p_expires_at timestamptz DEFAULT NULL,
  p_observacoes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_code text;
  v_id uuid;
  v_actor uuid;
  v_attempt integer;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  IF p_tool_id IS NOT NULL AND p_tool_id NOT IN ('termination','retirement','vacation','thirteenth','benefits','bpc') THEN
    RAISE EXCEPTION 'Calculadora inválida' USING ERRCODE = '22023';
  END IF;
  IF p_expires_at IS NOT NULL AND p_expires_at <= now() THEN
    RAISE EXCEPTION 'A validade precisa estar no futuro' USING ERRCODE = '22023';
  END IF;

  BEGIN
    SELECT public.gsa_current_actor_id() INTO v_actor;
  EXCEPTION WHEN OTHERS THEN
            RAISE
            RAISE EXCEPTION 'Erro em gsa_admin_create_calculator_pro_voucher: %', SQLERRM;
        EXCEPTION 'Erro em gsa_admin_create_calculator_pro_voucher: %', SQLERRM;
        END;

  FOR v_attempt IN 1..5 LOOP
    v_code := 'GSA-PRO-' || upper(encode(gen_random_bytes(10), 'hex'));
    BEGIN
      INSERT INTO public.gsa_calculator_pro_vouchers(
        code_hash, code_hint, tool_id, expires_at, observacoes, created_by
      ) VALUES (
        encode(digest(upper(v_code), 'sha256'), 'hex'),
        right(v_code, 6),
        p_tool_id,
        p_expires_at,
        nullif(btrim(p_observacoes), ''),
        v_actor
      ) RETURNING id INTO v_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempt = 5 THEN RAISE; END IF;
    END;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'id', v_id, 'code', v_code);
END;
$$;

