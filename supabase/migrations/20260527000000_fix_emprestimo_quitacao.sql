-- Correção da Automação de Quitação Total e Pagamento de Parcelas
CREATE OR REPLACE FUNCTION fn_processar_pagamento_quitacao_emprestimo()
RETURNS TRIGGER AS $$
DECLARE
    v_pendentes INT;
BEGIN
    -- Se a fatura foi paga e tem um emprestimo_id vinculado
    IF (NEW.status = 'pago' AND OLD.status != 'pago' AND NEW.emprestimo_id IS NOT NULL AND NEW.tipo = 'emprestimo') THEN
        
        -- Atualiza a parcela específica associada a esta fatura
        UPDATE emprestimo_parcelas
        SET status = 'paga', data_pagamento = CURRENT_TIMESTAMP
        WHERE fatura_id = NEW.id;

        -- Conta quantas parcelas ainda não estão pagas para este empréstimo
        SELECT count(*) INTO v_pendentes
        FROM emprestimo_parcelas
        WHERE emprestimo_id = NEW.emprestimo_id AND status != 'paga';

        -- Se não houver mais pendências (ou seja, todas as parcelas foram pagas ou é uma quitação total)
        IF (v_pendentes = 0) THEN
             UPDATE emprestimos 
             SET status = 'quitado' 
             WHERE id = NEW.emprestimo_id;
             
             INSERT INTO emprestimo_historico (emprestimo_id, tipo_acao, descricao, usuario_tipo, usuario_id)
             VALUES (NEW.emprestimo_id, 'quitacao_confirmada', 'Quitação total confirmada via pagamento da fatura ' || NEW.codigo_fatura, 'sistema', NEW.cliente_id);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
