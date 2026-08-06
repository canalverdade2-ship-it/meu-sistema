-- ====================================================================================
-- MIGRATION: 20260729120000_optimize_performance_indexes_and_sequences.sql
-- DESCRICAO: Otimização de Performance, Sequências para Inserção Concorrente e Índices
-- ====================================================================================

-- 1. SEQUÊNCIAS PARA GERAÇÃO RÁPIDA E SEGURA DE CÓDIGOS (SEM SELECT COUNT)
CREATE SEQUENCE IF NOT EXISTS seq_codigo_cliente START WITH 101;
CREATE SEQUENCE IF NOT EXISTS seq_codigo_orcamento START WITH 1001;
CREATE SEQUENCE IF NOT EXISTS seq_codigo_os START WITH 5001;
CREATE SEQUENCE IF NOT EXISTS seq_codigo_compra START WITH 1001;
CREATE SEQUENCE IF NOT EXISTS seq_codigo_assinatura START WITH 1001;
CREATE SEQUENCE IF NOT EXISTS seq_codigo_fatura START WITH 10001;
CREATE SEQUENCE IF NOT EXISTS seq_codigo_saque START WITH 1001;
CREATE SEQUENCE IF NOT EXISTS seq_codigo_transferencia START WITH 1001;
CREATE SEQUENCE IF NOT EXISTS seq_codigo_servico START WITH 101;
CREATE SEQUENCE IF NOT EXISTS seq_codigo_produto START WITH 101;
CREATE SEQUENCE IF NOT EXISTS seq_codigo_promocao START WITH 101;

-- 2. REFORMULAÇÃO DO TRIGGER DE GERAÇÃO DE CÓDIGO (SEM FULL TABLE SCAN)
CREATE OR REPLACE FUNCTION generate_system_code()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_TABLE_NAME = 'clientes' AND (NEW.codigo_cliente IS NULL OR NEW.codigo_cliente = '') THEN
        NEW.codigo_cliente := 'CL' || nextval('seq_codigo_cliente');
    ELSIF TG_TABLE_NAME = 'servicos' AND (NEW.codigo_servico IS NULL OR NEW.codigo_servico = '') THEN
        NEW.codigo_servico := 'SRV' || nextval('seq_codigo_servico');
    ELSIF TG_TABLE_NAME = 'produtos' AND (NEW.codigo_produto IS NULL OR NEW.codigo_produto = '') THEN
        NEW.codigo_produto := 'PRD' || nextval('seq_codigo_produto');
    ELSIF TG_TABLE_NAME = 'assinaturas' AND (NEW.codigo_assinatura IS NULL OR NEW.codigo_assinatura = '') THEN
        NEW.codigo_assinatura := 'SUB' || nextval('seq_codigo_assinatura');
    ELSIF TG_TABLE_NAME = 'promocoes' AND (NEW.codigo_promocao IS NULL OR NEW.codigo_promocao = '') THEN
        NEW.codigo_promocao := 'PRM' || nextval('seq_codigo_promocao');
    ELSIF TG_TABLE_NAME = 'orcamentos' AND (NEW.codigo_orcamento IS NULL OR NEW.codigo_orcamento = '') THEN
        NEW.codigo_orcamento := 'ORC' || nextval('seq_codigo_orcamento');
    ELSIF TG_TABLE_NAME = 'ordens_servico' AND (NEW.codigo_os IS NULL OR NEW.codigo_os = '') THEN
        NEW.codigo_os := 'OS' || nextval('seq_codigo_os');
    ELSIF TG_TABLE_NAME = 'ordens_compra' AND (NEW.codigo_ordem IS NULL OR NEW.codigo_ordem = '') THEN
        NEW.codigo_ordem := 'OC' || nextval('seq_codigo_compra');
    ELSIF TG_TABLE_NAME = 'ordens_assinatura' AND (NEW.codigo_ordem IS NULL OR NEW.codigo_ordem = '') THEN
        NEW.codigo_ordem := 'OA' || nextval('seq_codigo_assinatura');
    ELSIF TG_TABLE_NAME = 'faturas' AND (NEW.codigo_fatura IS NULL OR NEW.codigo_fatura = '') THEN
        NEW.codigo_fatura := 'FAT' || nextval('seq_codigo_fatura');
    ELSIF TG_TABLE_NAME = 'saques' AND (NEW.codigo_saque IS NULL OR NEW.codigo_saque = '') THEN
        NEW.codigo_saque := 'SAQ' || nextval('seq_codigo_saque');
    ELSIF TG_TABLE_NAME = 'transferencias' AND (NEW.codigo_transferencia IS NULL OR NEW.codigo_transferencia = '') THEN
        NEW.codigo_transferencia := 'TRF' || nextval('seq_codigo_transferencia');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 3. HARDENING DE SEGURANÇA EM FUNCTION DE GAMIFICAÇÃO
CREATE OR REPLACE FUNCTION secure_add_gamification_points(
    p_cliente_id UUID,
    p_pontos_gerados NUMERIC,
    p_descricao TEXT,
    p_tipo TEXT,
    p_fatura_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_saldo_atual NUMERIC;
    v_pontos_totais NUMERIC;
    v_nivel_atual UUID;
    v_nivel_manual UUID;
    
    v_novo_saldo NUMERIC;
    v_novos_totais NUMERIC;
    v_novo_nivel UUID;
    v_nome_novo_nivel TEXT;
    v_pontos_por_real NUMERIC;
    v_pontos_inteiros INTEGER;
    
    v_resultado JSONB;
BEGIN
    -- Arredondamento explícito para evitar truncamento silencioso
    v_pontos_inteiros := ROUND(p_pontos_gerados);

    -- Obter os dados atuais do cliente com bloqueio FOR UPDATE
    SELECT saldo_pontos, pontos_totais, nivel_id, nivel_manual_id 
    INTO v_saldo_atual, v_pontos_totais, v_nivel_atual, v_nivel_manual
    FROM clientes
    WHERE id = p_cliente_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cliente não encontrado');
    END IF;

    -- Calcular novos totais
    v_novo_saldo := GREATEST(0, COALESCE(v_saldo_atual, 0) + v_pontos_inteiros);
    v_novos_totais := COALESCE(v_pontos_totais, 0) + GREATEST(0, v_pontos_inteiros);

    -- Atualizar cliente
    UPDATE clientes 
    SET saldo_pontos = v_novo_saldo,
        pontos_totais = v_novos_totais,
        updated_at = NOW()
    WHERE id = p_cliente_id;

    -- Registrar histórico
    INSERT INTO pontos_movimentacoes (cliente_id, fatura_id, tipo, pontos, saldo_apos, descricao)
    VALUES (p_cliente_id, p_fatura_id, p_tipo, v_pontos_inteiros, v_novo_saldo, p_descricao);

    INSERT INTO points_transactions (cliente_id, fatura_id, tipo, pontos, descricao)
    VALUES (p_cliente_id, p_fatura_id, p_tipo, v_pontos_inteiros, p_descricao);

    -- Verificar Level Up
    IF v_nivel_manual IS NULL AND v_pontos_inteiros > 0 THEN
        SELECT id, nome_nivel, pontos_por_real 
        INTO v_novo_nivel, v_nome_novo_nivel, v_pontos_por_real
        FROM client_levels 
        WHERE pontos_minimos <= v_novos_totais 
        ORDER BY pontos_minimos DESC 
        LIMIT 1;

        IF v_novo_nivel IS NOT NULL AND v_novo_nivel != v_nivel_atual THEN
            UPDATE clientes SET nivel_id = v_novo_nivel WHERE id = p_cliente_id;
            
            INSERT INTO level_history (cliente_id, nivel_anterior_id, nivel_novo_id)
            VALUES (p_cliente_id, v_nivel_atual, v_novo_nivel);
        END IF;
    END IF;

    v_resultado := jsonb_build_object(
        'success', true,
        'novo_saldo', v_novo_saldo,
        'level_up', (v_novo_nivel != v_nivel_atual),
        'novo_nivel_nome', v_nome_novo_nivel,
        'pontos_por_real', v_pontos_por_real
    );

    RETURN v_resultado;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Erro ao adicionar pontos de gamificação: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 4. ÍNDICES COMPOSTOS DE ALTA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_notificacoes_cliente_unread ON notificacoes (cliente_id, lida, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gsa_afiliado_cliques_afiliado ON gsa_afiliado_cliques (afiliado_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_promocoes_qtd_uso_cliente ON promocoes_quantidade_uso (promocao_id, cliente_id);
CREATE INDEX IF NOT EXISTS idx_fornecedor_prod_solic_status ON fornecedor_produto_solicitacoes (fornecedor_id, status);
CREATE INDEX IF NOT EXISTS idx_orcamentos_cliente_status ON orcamentos (cliente_id, status);
CREATE INDEX IF NOT EXISTS idx_faturas_cliente_status_venc ON faturas (cliente_id, status, data_vencimento);
CREATE INDEX IF NOT EXISTS idx_prestador_demandas_prestador_status ON prestador_demandas (prestador_id, status, created_at DESC);
