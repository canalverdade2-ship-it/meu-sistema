-- SCRIPT DE NOTIFICAÇÕES EM TEMPO REAL PARA TODOS OS MÓDULOS
-- Este script cria gatilhos (triggers) para automatizar as notificações em todo o sistema.

-- 1. Função genérica para criar notificações
CREATE OR REPLACE FUNCTION fn_criar_notificacao_automatica()
RETURNS TRIGGER AS $$
DECLARE
    v_cliente_id UUID;
    v_titulo TEXT;
    v_mensagem TEXT;
    v_modulo TEXT;
    v_item_id TEXT;
    v_tipo TEXT := 'info';
    v_emoji TEXT;
    v_new_json JSONB;
    v_old_json JSONB;
    v_new_status TEXT;
    v_old_status TEXT;
BEGIN
    -- Converte NEW para JSONB para acesso seguro a campos dinâmicos
    v_new_json := to_jsonb(NEW);
    v_item_id := (v_new_json->>'id');
    v_new_status := (v_new_json->>'status');
    
    IF (TG_OP = 'UPDATE') THEN
        v_old_json := to_jsonb(OLD);
        v_old_status := (v_old_json->>'status');
    END IF;
    
    CASE TG_TABLE_NAME
        WHEN 'orcamentos' THEN
            v_cliente_id := (v_new_json->>'cliente_id')::UUID;
            v_modulo := 'orcamentos';
            v_emoji := '📄✨';
            IF (TG_OP = 'INSERT') THEN
                v_titulo := 'Novo Orçamento Criado';
                v_mensagem := 'Um novo orçamento (' || COALESCE(v_new_json->>'codigo_orcamento', 'S/N') || ') foi registrado no sistema.';
                INSERT INTO notificacoes (cliente_id, titulo, mensagem, modulo, item_id, tipo)
                VALUES (NULL, v_emoji || ' ' || v_titulo, v_mensagem, v_modulo, v_item_id, 'admin');
            ELSIF (TG_OP = 'UPDATE' AND v_old_status IS DISTINCT FROM v_new_status) THEN
                v_titulo := 'Status do Orçamento Atualizado';
                v_mensagem := 'O orçamento ' || COALESCE(v_new_json->>'codigo_orcamento', 'S/N') || ' mudou para: ' || COALESCE(v_new_status, 'Indefinido');
                INSERT INTO notificacoes (cliente_id, titulo, mensagem, modulo, item_id, tipo)
                VALUES (v_cliente_id, v_emoji || ' ' || v_titulo, v_mensagem, v_modulo, v_item_id, 'status_change');
            END IF;

        WHEN 'ordens_servico' THEN
            v_cliente_id := (v_new_json->>'cliente_id')::UUID;
            v_modulo := 'servicos';
            v_emoji := '🛠️⚙️';
            IF (TG_OP = 'INSERT') THEN
                v_titulo := 'Nova Ordem de Serviço';
                v_mensagem := 'A OS ' || COALESCE(v_new_json->>'codigo_os', 'S/N') || ' foi iniciada com sucesso!';
            ELSIF (TG_OP = 'UPDATE' AND v_old_status IS DISTINCT FROM v_new_status) THEN
                v_titulo := 'OS Atualizada';
                v_mensagem := 'Sua Ordem de Serviço ' || COALESCE(v_new_json->>'codigo_os', 'S/N') || ' agora está: ' || COALESCE(v_new_status, 'Indefinido');
            END IF;
            IF v_titulo IS NOT NULL THEN
                INSERT INTO notificacoes (cliente_id, titulo, mensagem, modulo, item_id)
                VALUES (v_cliente_id, v_emoji || ' ' || v_titulo, v_mensagem, v_modulo, v_item_id);
            END IF;

        WHEN 'faturas' THEN
            v_cliente_id := (v_new_json->>'cliente_id')::UUID;
            v_modulo := 'financeiro';
            v_emoji := '💰💳';
            IF (TG_OP = 'INSERT') THEN
                v_titulo := 'Nova Fatura Gerada';
                v_mensagem := 'Uma nova fatura (' || COALESCE(v_new_json->>'codigo_fatura', 'S/N') || ') está disponível para pagamento.';
            ELSIF (TG_OP = 'UPDATE' AND v_old_status IS DISTINCT FROM v_new_status AND v_new_status = 'pago') THEN
                v_titulo := 'Pagamento Confirmado';
                v_mensagem := 'Recebemos o pagamento da fatura ' || COALESCE(v_new_json->>'codigo_fatura', 'S/N') || '. Obrigado! ✅';
            END IF;
            IF v_titulo IS NOT NULL THEN
                INSERT INTO notificacoes (cliente_id, titulo, mensagem, modulo, item_id)
                VALUES (v_cliente_id, v_emoji || ' ' || v_titulo, v_mensagem, v_modulo, v_item_id);
            END IF;

        WHEN 'tickets' THEN
            v_cliente_id := (v_new_json->>'cliente_id')::UUID;
            v_modulo := 'suporte';
            v_emoji := '💬🆘';
            IF (TG_OP = 'INSERT') THEN
                v_titulo := 'Novo Ticket de Suporte';
                v_mensagem := 'Seu ticket sobre "' || COALESCE(v_new_json->>'assunto', 'Sem Assunto') || '" foi aberto. Responderemos em breve!';
                INSERT INTO notificacoes (cliente_id, titulo, mensagem, modulo, item_id, tipo)
                VALUES (NULL, v_emoji || ' ' || v_titulo, 'Novo ticket de ' || COALESCE(v_cliente_id::TEXT, 'Desconhecido') || ': ' || COALESCE(v_new_json->>'assunto', 'Sem Assunto'), v_modulo, v_item_id, 'admin');
            END IF;
            IF v_titulo IS NOT NULL THEN
                INSERT INTO notificacoes (cliente_id, titulo, mensagem, modulo, item_id)
                VALUES (v_cliente_id, v_emoji || ' ' || v_titulo, v_mensagem, v_modulo, v_item_id);
            END IF;

        WHEN 'ticket_mensagens' THEN
            SELECT cliente_id INTO v_cliente_id FROM tickets WHERE id = (v_new_json->>'ticket_id')::UUID;
            v_modulo := 'suporte';
            v_emoji := '📩💬';
            IF (v_new_json->>'tipo' = 'admin') THEN
                v_titulo := 'Nova Resposta do Suporte';
                v_mensagem := 'O administrador respondeu ao seu ticket.';
                INSERT INTO notificacoes (cliente_id, titulo, mensagem, modulo, item_id)
                VALUES (v_cliente_id, v_emoji || ' ' || v_titulo, v_mensagem, v_modulo, (v_new_json->>'ticket_id'));
            ELSE
                v_titulo := 'Nova Mensagem do Cliente';
                v_mensagem := 'O cliente enviou uma mensagem no ticket.';
                INSERT INTO notificacoes (cliente_id, titulo, mensagem, modulo, item_id, tipo)
                VALUES (NULL, v_emoji || ' ' || v_titulo, v_mensagem, v_modulo, (v_new_json->>'ticket_id'), 'admin');
            END IF;

        WHEN 'transferencias' THEN
            v_modulo := 'transferencias';
            v_emoji := '💸↔️';
            IF (TG_OP = 'INSERT') THEN
                v_cliente_id := (v_new_json->>'cliente_origem_id')::UUID;
                INSERT INTO notificacoes (cliente_id, titulo, mensagem, modulo, item_id)
                VALUES (v_cliente_id, v_emoji || ' Solicitação de Transferência', 'Sua solicitação de ' || COALESCE(v_new_json->>'tipo', 'transferência') || ' foi enviada para análise.', v_modulo, v_item_id);
                INSERT INTO notificacoes (cliente_id, titulo, mensagem, modulo, item_id, tipo)
                VALUES (NULL, v_emoji || ' Nova Transferência Pendente', 'Uma nova transferência aguarda sua aprovação.', v_modulo, v_item_id, 'admin');
            ELSIF (TG_OP = 'UPDATE' AND v_old_status IS DISTINCT FROM v_new_status) THEN
                v_cliente_id := (v_new_json->>'cliente_origem_id')::UUID;
                INSERT INTO notificacoes (cliente_id, titulo, mensagem, modulo, item_id)
                VALUES (v_cliente_id, v_emoji || ' Transferência ' || COALESCE(v_new_status, 'Atualizada'), 'Sua transferência foi ' || COALESCE(v_new_status, 'atualizada') || '.', v_modulo, v_item_id);
                
                IF (v_new_status = 'concluido' OR v_new_status = 'aprovado') THEN
                    INSERT INTO notificacoes (cliente_id, titulo, mensagem, modulo, item_id)
                    VALUES ((v_new_json->>'cliente_destino_id')::UUID, v_emoji || ' Você recebeu uma Transferência!', 'Você recebeu ' || COALESCE(v_new_json->>'valor', '0') || ' em ' || COALESCE(v_new_json->>'tipo', 'saldo') || '.', v_modulo, v_item_id);
                END IF;
            END IF;

        WHEN 'indicacoes' THEN
            v_cliente_id := (v_new_json->>'indicador_id')::UUID;
            v_modulo := 'indique-ganhe';
            v_emoji := '🤝🎉';
            IF (TG_OP = 'INSERT') THEN
                v_titulo := 'Nova Indicação Realizada';
                v_mensagem := 'Você indicou ' || COALESCE(v_new_json->>'indicado_nome', 'alguém') || '. Acompanhe o status!';
            ELSIF (TG_OP = 'UPDATE' AND v_old_status IS DISTINCT FROM v_new_status AND v_new_status = 'concluída') THEN
                v_titulo := 'Indicação Concluída! 🏆';
                v_mensagem := 'Sua indicação de ' || COALESCE(v_new_json->>'indicado_nome', 'alguém') || ' foi finalizada. Seu bônus foi creditado!';
            END IF;
            IF v_titulo IS NOT NULL THEN
                INSERT INTO notificacoes (cliente_id, titulo, mensagem, modulo, item_id)
                VALUES (v_cliente_id, v_emoji || ' ' || v_titulo, v_mensagem, v_modulo, v_item_id);
            END IF;

        WHEN 'pontos_movimentacoes' THEN
            v_cliente_id := (v_new_json->>'cliente_id')::UUID;
            v_modulo := 'pontos';
            v_emoji := '⭐🏆';
            IF (COALESCE((v_new_json->>'pontos')::NUMERIC, 0) > 0) THEN
                v_titulo := 'Você Ganhou Pontos! 🚀';
                v_mensagem := 'Você recebeu ' || COALESCE(v_new_json->>'pontos', '0') || ' pontos: ' || COALESCE(v_new_json->>'descricao', 'Sem descrição');
            ELSE
                v_titulo := 'Pontos Utilizados';
                v_mensagem := 'Você utilizou ' || ABS(COALESCE((v_new_json->>'pontos')::NUMERIC, 0)) || ' pontos: ' || COALESCE(v_new_json->>'descricao', 'Sem descrição');
            END IF;
            INSERT INTO notificacoes (cliente_id, titulo, mensagem, modulo, item_id)
            VALUES (v_cliente_id, v_emoji || ' ' || v_titulo, v_mensagem, v_modulo, v_item_id);

        WHEN 'cliente_promocoes' THEN
            v_cliente_id := (v_new_json->>'cliente_id')::UUID;
            v_modulo := 'promocoes';
            v_emoji := '🔥📢';
            IF (TG_OP = 'INSERT') THEN
                v_titulo := 'Nova Promoção Ativada! 🎁';
                v_mensagem := 'Você ativou uma nova promoção. Aproveite antes que expire!';
                INSERT INTO notificacoes (cliente_id, titulo, mensagem, modulo, item_id)
                VALUES (v_cliente_id, v_emoji || ' ' || v_titulo, v_mensagem, v_modulo, v_item_id);
            END IF;

        WHEN 'pagamentos' THEN
            v_cliente_id := (v_new_json->>'cliente_id')::UUID;
            v_modulo := 'financeiro';
            v_emoji := '💳✅';
            IF (TG_OP = 'INSERT') THEN
                v_titulo := 'Pagamento Recebido';
                v_mensagem := 'Seu pagamento de ' || COALESCE(v_new_json->>'valor', '0') || ' foi processado.';
                INSERT INTO notificacoes (cliente_id, titulo, mensagem, modulo, item_id)
                VALUES (v_cliente_id, v_emoji || ' ' || v_titulo, v_mensagem, v_modulo, v_item_id);
            END IF;

        WHEN 'saques' THEN
            v_cliente_id := (v_new_json->>'cliente_id')::UUID;
            v_modulo := 'financeiro';
            v_emoji := '🏧💰';
            IF (TG_OP = 'INSERT') THEN
                v_titulo := 'Solicitação de Saque';
                v_mensagem := 'Seu pedido de saque de ' || COALESCE(v_new_json->>'valor', '0') || ' foi enviado para análise.';
            ELSIF (TG_OP = 'UPDATE' AND v_old_status IS DISTINCT FROM v_new_status) THEN
                v_titulo := 'Status do Saque Atualizado';
                v_mensagem := 'Seu saque agora está: ' || COALESCE(v_new_status, 'Indefinido');
            END IF;
            IF v_titulo IS NOT NULL THEN
                INSERT INTO notificacoes (cliente_id, titulo, mensagem, modulo, item_id)
                VALUES (v_cliente_id, v_emoji || ' ' || v_titulo, v_mensagem, v_modulo, v_item_id);
            END IF;

        WHEN 'vouchers' THEN
            v_cliente_id := (v_new_json->>'cliente_id')::UUID;
            v_modulo := 'vouchers';
            v_emoji := '🎟️🎁';
            IF (TG_OP = 'INSERT') THEN
                v_titulo := 'Novo Voucher Recebido';
                v_mensagem := 'Você recebeu um novo voucher: ' || COALESCE(v_new_json->>'codigo_voucher', 'S/N');
                INSERT INTO notificacoes (cliente_id, titulo, mensagem, modulo, item_id)
                VALUES (v_cliente_id, v_emoji || ' ' || v_titulo, v_mensagem, v_modulo, v_item_id);
            END IF;

        WHEN 'ordens_compra' THEN
            v_cliente_id := (v_new_json->>'cliente_id')::UUID;
            v_modulo := 'produtos';
            v_emoji := '🛍️📦';
            IF (TG_OP = 'INSERT') THEN
                v_titulo := 'Nova Compra Realizada';
                v_mensagem := 'Seu pedido de produto foi registrado com sucesso.';
            ELSIF (TG_OP = 'UPDATE' AND v_old_status IS DISTINCT FROM v_new_status) THEN
                v_titulo := 'Status do Pedido Atualizado';
                v_mensagem := 'Seu pedido de produto agora está: ' || COALESCE(v_new_status, 'Indefinido');
            END IF;
            IF v_titulo IS NOT NULL THEN
                INSERT INTO notificacoes (cliente_id, titulo, mensagem, modulo, item_id)
                VALUES (v_cliente_id, v_emoji || ' ' || v_titulo, v_mensagem, v_modulo, v_item_id);
            END IF;

        WHEN 'ordens_assinatura' THEN
            v_cliente_id := (v_new_json->>'cliente_id')::UUID;
            v_modulo := 'assinaturas';
            v_emoji := '📅🔄';
            IF (TG_OP = 'INSERT') THEN
                v_titulo := 'Nova Assinatura Ativada';
                v_mensagem := 'Sua assinatura foi registrada no sistema.';
            ELSIF (TG_OP = 'UPDATE' AND v_old_status IS DISTINCT FROM v_new_status) THEN
                v_titulo := 'Status da Assinatura Atualizado';
                v_mensagem := 'Sua assinatura agora está: ' || COALESCE(v_new_status, 'Indefinido');
            END IF;
            IF v_titulo IS NOT NULL THEN
                INSERT INTO notificacoes (cliente_id, titulo, mensagem, modulo, item_id)
                VALUES (v_cliente_id, v_emoji || ' ' || v_titulo, v_mensagem, v_modulo, v_item_id);
            END IF;

        ELSE
            -- Caso a tabela não seja tratada, não faz nada (evita erro "case not found")
            NULL;
    END CASE;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Aplicar Triggers nas tabelas
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'faturas' AND trigger_schema = 'public')
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) || ' ON faturas';
    END LOOP;
END $$;

-- Re-criar o trigger de código de fatura (que estava em recreate_database.sql)
DROP TRIGGER IF EXISTS trg_invoice_code ON faturas;
CREATE TRIGGER trg_invoice_code BEFORE INSERT ON faturas FOR EACH ROW EXECUTE FUNCTION generate_invoice_code();

DROP TRIGGER IF EXISTS trg_notif_orcamentos ON orcamentos;
CREATE TRIGGER trg_notif_orcamentos AFTER INSERT OR UPDATE ON orcamentos FOR EACH ROW EXECUTE FUNCTION fn_criar_notificacao_automatica();

DROP TRIGGER IF EXISTS trg_notif_os ON ordens_servico;
CREATE TRIGGER trg_notif_os AFTER INSERT OR UPDATE ON ordens_servico FOR EACH ROW EXECUTE FUNCTION fn_criar_notificacao_automatica();

DROP TRIGGER IF EXISTS trg_notif_faturas ON faturas;
CREATE TRIGGER trg_notif_faturas AFTER INSERT OR UPDATE ON faturas FOR EACH ROW EXECUTE FUNCTION fn_criar_notificacao_automatica();

DROP TRIGGER IF EXISTS trg_notif_tickets ON tickets;
CREATE TRIGGER trg_notif_tickets AFTER INSERT ON tickets FOR EACH ROW EXECUTE FUNCTION fn_criar_notificacao_automatica();

DROP TRIGGER IF EXISTS trg_notif_ticket_msgs ON ticket_mensagens;
CREATE TRIGGER trg_notif_ticket_msgs AFTER INSERT ON ticket_mensagens FOR EACH ROW EXECUTE FUNCTION fn_criar_notificacao_automatica();

DROP TRIGGER IF EXISTS trg_notif_transferencias ON transferencias;
CREATE TRIGGER trg_notif_transferencias AFTER INSERT OR UPDATE ON transferencias FOR EACH ROW EXECUTE FUNCTION fn_criar_notificacao_automatica();

DROP TRIGGER IF EXISTS trg_notif_indicacoes ON indicacoes;
CREATE TRIGGER trg_notif_indicacoes AFTER INSERT OR UPDATE ON indicacoes FOR EACH ROW EXECUTE FUNCTION fn_criar_notificacao_automatica();

DROP TRIGGER IF EXISTS trg_notif_pontos ON pontos_movimentacoes;
CREATE TRIGGER trg_notif_pontos AFTER INSERT ON pontos_movimentacoes FOR EACH ROW EXECUTE FUNCTION fn_criar_notificacao_automatica();

DROP TRIGGER IF EXISTS trg_notif_cliente_promocoes ON cliente_promocoes;
CREATE TRIGGER trg_notif_cliente_promocoes AFTER INSERT ON cliente_promocoes FOR EACH ROW EXECUTE FUNCTION fn_criar_notificacao_automatica();

-- Triggers adicionais para tabelas que podem disparar notificações
DROP TRIGGER IF EXISTS trg_notif_pagamentos ON pagamentos;
CREATE TRIGGER trg_notif_pagamentos AFTER INSERT ON pagamentos FOR EACH ROW EXECUTE FUNCTION fn_criar_notificacao_automatica();

DROP TRIGGER IF EXISTS trg_notif_saques ON saques;
CREATE TRIGGER trg_notif_saques AFTER INSERT OR UPDATE ON saques FOR EACH ROW EXECUTE FUNCTION fn_criar_notificacao_automatica();

DROP TRIGGER IF EXISTS trg_notif_vouchers ON vouchers;
CREATE TRIGGER trg_notif_vouchers AFTER INSERT ON vouchers FOR EACH ROW EXECUTE FUNCTION fn_criar_notificacao_automatica();

DROP TRIGGER IF EXISTS trg_notif_ordens_compra ON ordens_compra;
CREATE TRIGGER trg_notif_ordens_compra AFTER INSERT OR UPDATE ON ordens_compra FOR EACH ROW EXECUTE FUNCTION fn_criar_notificacao_automatica();

DROP TRIGGER IF EXISTS trg_notif_ordens_assinatura ON ordens_assinatura;
CREATE TRIGGER trg_notif_ordens_assinatura AFTER INSERT OR UPDATE ON ordens_assinatura FOR EACH ROW EXECUTE FUNCTION fn_criar_notificacao_automatica();
