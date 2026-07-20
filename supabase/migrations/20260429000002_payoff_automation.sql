-- Automação de Quitação Total
CREATE OR REPLACE FUNCTION fn_processar_pagamento_quitacao_emprestimo()
RETURNS TRIGGER AS $$
BEGIN
    -- Se a fatura foi paga e tem um emprestimo_id vinculado
    IF (NEW.status = 'pago' AND OLD.status != 'pago' AND NEW.emprestimo_id IS NOT NULL) THEN
        IF (NEW.tipo = 'emprestimo') THEN
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

DROP TRIGGER IF EXISTS trg_pagamento_quitacao ON faturas;
CREATE TRIGGER trg_pagamento_quitacao
AFTER UPDATE ON faturas
FOR EACH ROW
EXECUTE FUNCTION fn_processar_pagamento_quitacao_emprestimo();
