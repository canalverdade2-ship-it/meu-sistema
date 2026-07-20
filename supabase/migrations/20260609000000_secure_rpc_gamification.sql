-- Migration para Segurança de Gamificação (Remoção de Autoridade do Cliente)

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
    
    v_resultado JSONB;
BEGIN
    -- Obter os dados atuais do cliente com bloqueio FOR UPDATE (Evita Race Conditions)
    SELECT saldo_pontos, pontos_totais, nivel_id, nivel_manual_id 
    INTO v_saldo_atual, v_pontos_totais, v_nivel_atual, v_nivel_manual
    FROM clientes 
    WHERE id = p_cliente_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cliente não encontrado';
    END IF;

    -- Cálculos
    v_novo_saldo := GREATEST(0, COALESCE(v_saldo_atual, 0) + p_pontos_gerados);
    v_novos_totais := GREATEST(0, COALESCE(v_pontos_totais, 0) + p_pontos_gerados);
    v_novo_nivel := v_nivel_atual;
    v_nome_novo_nivel := NULL;

    -- Atualizar cliente
    UPDATE clientes 
    SET saldo_pontos = v_novo_saldo,
        pontos_totais = v_novos_totais
    WHERE id = p_cliente_id;

    -- Gravar movimentações financeiras
    INSERT INTO pontos_movimentacoes (cliente_id, fatura_id, tipo, pontos, saldo_apos, descricao)
    VALUES (p_cliente_id, p_fatura_id, p_tipo, p_pontos_gerados, v_novo_saldo, p_descricao);

    INSERT INTO points_transactions (cliente_id, fatura_id, tipo, pontos, descricao)
    VALUES (p_cliente_id, p_fatura_id, p_tipo, p_pontos_gerados, p_descricao);

    -- Verificar Level Up (se não for manual)
    IF v_nivel_manual IS NULL AND p_pontos_gerados > 0 THEN
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
            
            -- Não enviamos a notificação aqui para manter a camada de apresentação desacoplada,
            -- mas retornamos a flag para o frontend exibir
        END IF;
    END IF;

    -- Retornar o resultado para o frontend
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
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
