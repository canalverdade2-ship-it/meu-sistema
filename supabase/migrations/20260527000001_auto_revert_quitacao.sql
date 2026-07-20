-- Adicionar coluna de vínculo nas tabelas para não precisarmos deletar as parcelas
ALTER TABLE faturas ADD COLUMN IF NOT EXISTS quitacao_fatura_id UUID REFERENCES faturas(id) ON DELETE SET NULL;
ALTER TABLE emprestimo_parcelas ADD COLUMN IF NOT EXISTS quitacao_fatura_id UUID REFERENCES faturas(id) ON DELETE SET NULL;

-- Criar a função RPC para ser chamada periodicamente
CREATE OR REPLACE FUNCTION process_expired_quitacoes()
RETURNS void AS $$
DECLARE
    q_record RECORD;
BEGIN
    -- Busca faturas de quitação que venceram ontem ou antes
    FOR q_record IN
        SELECT id FROM faturas 
        WHERE status IN ('pendente', 'vencida')
          AND data_vencimento < CURRENT_DATE
          AND (is_amortizacao_credito = true OR (itens_faturados->0->>'id' LIKE 'quitacao-%'))
    LOOP
        -- 1. Marca a fatura de quitação em si como cancelada
        UPDATE faturas 
        SET status = 'cancelada' 
        WHERE id = q_record.id;
        
        -- 2. Restaura faturas originais de Crédito vinculadas a essa quitação
        UPDATE faturas 
        SET status = 'pendente', quitacao_fatura_id = NULL 
        WHERE quitacao_fatura_id = q_record.id AND status IN ('cancelada', 'cancelado');
        
        -- 3. Restaura parcelas de Empréstimo vinculadas a essa quitação
        UPDATE emprestimo_parcelas 
        SET status = 'pendente', quitacao_fatura_id = NULL 
        WHERE quitacao_fatura_id = q_record.id AND status IN ('cancelada', 'cancelado', 'suspensa');
    END LOOP;
END;
$$ LANGUAGE plpgsql;
