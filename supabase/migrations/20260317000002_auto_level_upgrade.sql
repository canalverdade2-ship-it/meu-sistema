-- Função para processar o upgrade de nível automático quando uma fatura de pacote_nivel é paga
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

            -- 3. Cria uma notificação especial de upgrade
            INSERT INTO notificacoes (cliente_id, titulo, mensagem, modulo, item_id)
            VALUES (
                v_cliente_id, 
                '🚀 Upgrade de Nível Confirmado!', 
                'Parabéns! Seu nível foi atualizado para ' || COALESCE(v_nivel_nome, 'Novo Nível') || '. Aproveite seus novos benefícios!', 
                'vip', 
                v_pacote_nivel_id::TEXT
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar o trigger na tabela faturas
DROP TRIGGER IF EXISTS trg_upgrade_nivel_fatura ON faturas;
CREATE TRIGGER trg_upgrade_nivel_fatura 
AFTER UPDATE ON faturas 
FOR EACH ROW 
EXECUTE FUNCTION fn_processar_upgrade_nivel_automatico();
