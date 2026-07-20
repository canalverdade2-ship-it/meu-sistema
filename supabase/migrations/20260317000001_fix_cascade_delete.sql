-- Script robusto para configurar ON DELETE CASCADE apenas em tabelas que existem
-- Isso resolve o erro de "relation does not exist" ao rodar a migração

DO $$ 
DECLARE
    t_name TEXT;
BEGIN
    -- Lista de tabelas e suas respectivas constraints de cliente_id que devem ser CASCADE
    -- Formato: {tabela, constraint_name, coluna_referencia}
    
    -- 1. Orçamentos
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orcamentos') THEN
        ALTER TABLE orcamentos DROP CONSTRAINT IF EXISTS orcamentos_cliente_id_fkey;
        ALTER TABLE orcamentos ADD CONSTRAINT orcamentos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;
    END IF;

    -- 2. Ordens de Serviço
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ordens_servico') THEN
        ALTER TABLE ordens_servico DROP CONSTRAINT IF EXISTS ordens_servico_cliente_id_fkey;
        ALTER TABLE ordens_servico ADD CONSTRAINT ordens_servico_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;
        
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orcamentos') THEN
            ALTER TABLE ordens_servico DROP CONSTRAINT IF EXISTS ordens_servico_orcamento_id_fkey;
            ALTER TABLE ordens_servico ADD CONSTRAINT ordens_servico_orcamento_id_fkey FOREIGN KEY (orcamento_id) REFERENCES orcamentos(id) ON DELETE CASCADE;
        END IF;
    END IF;

    -- 3. Faturas
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'faturas') THEN
        ALTER TABLE faturas DROP CONSTRAINT IF EXISTS faturas_cliente_id_fkey;
        ALTER TABLE faturas ADD CONSTRAINT faturas_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;
        
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ordens_servico') THEN
            ALTER TABLE faturas DROP CONSTRAINT IF EXISTS faturas_os_id_fkey;
            ALTER TABLE faturas ADD CONSTRAINT faturas_os_id_fkey FOREIGN KEY (os_id) REFERENCES ordens_servico(id) ON DELETE CASCADE;
        END IF;
    END IF;

    -- 4. Pagamentos
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pagamentos') THEN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'faturas') THEN
            ALTER TABLE pagamentos DROP CONSTRAINT IF EXISTS pagamentos_fatura_id_fkey;
            ALTER TABLE pagamentos ADD CONSTRAINT pagamentos_fatura_id_fkey FOREIGN KEY (fatura_id) REFERENCES faturas(id) ON DELETE CASCADE;
        END IF;
    END IF;

    -- 5. Carteira e Financeiro
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'carteira_lancamentos') THEN
        ALTER TABLE carteira_lancamentos DROP CONSTRAINT IF EXISTS carteira_lancamentos_cliente_id_fkey;
        ALTER TABLE carteira_lancamentos ADD CONSTRAINT carteira_lancamentos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'extrato_financeiro') THEN
        ALTER TABLE extrato_financeiro DROP CONSTRAINT IF EXISTS extrato_financeiro_cliente_id_fkey;
        ALTER TABLE extrato_financeiro ADD CONSTRAINT extrato_financeiro_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;
    END IF;

    -- 6. Tickets e Suporte
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tickets') THEN
        ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_cliente_id_fkey;
        ALTER TABLE tickets ADD CONSTRAINT tickets_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;
        
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ticket_mensagens') THEN
            ALTER TABLE ticket_mensagens DROP CONSTRAINT IF EXISTS ticket_mensagens_ticket_id_fkey;
            ALTER TABLE ticket_mensagens ADD CONSTRAINT ticket_mensagens_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE;
        END IF;
    END IF;

    -- 7. Saques e Indicações
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'saques') THEN
        ALTER TABLE saques DROP CONSTRAINT IF EXISTS saques_cliente_id_fkey;
        ALTER TABLE saques ADD CONSTRAINT saques_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'indicacoes') THEN
        ALTER TABLE indicacoes DROP CONSTRAINT IF EXISTS indicacoes_indicador_id_fkey;
        ALTER TABLE indicacoes ADD CONSTRAINT indicacoes_indicador_id_fkey FOREIGN KEY (indicador_id) REFERENCES clientes(id) ON DELETE CASCADE;
    END IF;

    -- 8. Vouchers
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vouchers') THEN
        ALTER TABLE vouchers DROP CONSTRAINT IF EXISTS vouchers_cliente_id_fkey;
        ALTER TABLE vouchers ADD CONSTRAINT vouchers_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;
    END IF;

    -- 9. Transferências
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transferencias') THEN
        ALTER TABLE transferencias DROP CONSTRAINT IF EXISTS transferencias_cliente_origem_id_fkey;
        ALTER TABLE transferencias ADD CONSTRAINT transferencias_cliente_origem_id_fkey FOREIGN KEY (cliente_origem_id) REFERENCES clientes(id) ON DELETE CASCADE;

        ALTER TABLE transferencias DROP CONSTRAINT IF EXISTS transferencias_cliente_destino_id_fkey;
        ALTER TABLE transferencias ADD CONSTRAINT transferencias_cliente_destino_id_fkey FOREIGN KEY (cliente_destino_id) REFERENCES clientes(id) ON DELETE CASCADE;
    END IF;

    -- 10. Ordens de Compra e Assinatura
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ordens_compra') THEN
        ALTER TABLE ordens_compra DROP CONSTRAINT IF EXISTS ordens_compra_cliente_id_fkey;
        ALTER TABLE ordens_compra ADD CONSTRAINT ordens_compra_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ordens_assinatura') THEN
        ALTER TABLE ordens_assinatura DROP CONSTRAINT IF EXISTS ordens_assinatura_cliente_id_fkey;
        ALTER TABLE ordens_assinatura ADD CONSTRAINT ordens_assinatura_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;
    END IF;

    -- 11. Gamificação e Pontos
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pontos_movimentacoes') THEN
        ALTER TABLE pontos_movimentacoes DROP CONSTRAINT IF EXISTS pontos_movimentacoes_cliente_id_fkey;
        ALTER TABLE pontos_movimentacoes ADD CONSTRAINT pontos_movimentacoes_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'points_transactions') THEN
        ALTER TABLE points_transactions DROP CONSTRAINT IF EXISTS points_transactions_cliente_id_fkey;
        ALTER TABLE points_transactions ADD CONSTRAINT points_transactions_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'level_history') THEN
        ALTER TABLE level_history DROP CONSTRAINT IF EXISTS level_history_cliente_id_fkey;
        ALTER TABLE level_history ADD CONSTRAINT level_history_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;
    END IF;

    -- 12. Notificações
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notificacoes') THEN
        ALTER TABLE notificacoes DROP CONSTRAINT IF EXISTS notificacoes_cliente_id_fkey;
        ALTER TABLE notificacoes ADD CONSTRAINT notificacoes_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;
    END IF;

    -- 13. Promoções
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cliente_promocoes') THEN
        ALTER TABLE cliente_promocoes DROP CONSTRAINT IF EXISTS cliente_promocoes_cliente_id_fkey;
        ALTER TABLE cliente_promocoes ADD CONSTRAINT cliente_promocoes_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;
    END IF;

    -- 14. Transferências de Produtos
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transferencias_produtos') THEN
        ALTER TABLE transferencias_produtos DROP CONSTRAINT IF EXISTS transferencias_produtos_remetente_id_fkey;
        ALTER TABLE transferencias_produtos ADD CONSTRAINT transferencias_produtos_remetente_id_fkey FOREIGN KEY (remetente_id) REFERENCES clientes(id) ON DELETE CASCADE;

        ALTER TABLE transferencias_produtos DROP CONSTRAINT IF EXISTS transferencias_produtos_destinatario_id_fkey;
        ALTER TABLE transferencias_produtos ADD CONSTRAINT transferencias_produtos_destinatario_id_fkey FOREIGN KEY (destinatario_id) REFERENCES clientes(id) ON DELETE CASCADE;
    END IF;

    -- 15. Inventário de Produtos
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventario_produtos') THEN
        ALTER TABLE inventario_produtos DROP CONSTRAINT IF EXISTS inventario_produtos_cliente_id_fkey;
        ALTER TABLE inventario_produtos ADD CONSTRAINT inventario_produtos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;
    END IF;

END $$;
