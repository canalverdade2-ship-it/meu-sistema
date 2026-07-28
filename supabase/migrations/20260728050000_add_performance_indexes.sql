-- Índices de performance para consultas frequentes
-- Criados com IF NOT EXISTS para ser idempotente

-- Tabelas financeiras
CREATE INDEX IF NOT EXISTS idx_faturas_cliente_id ON faturas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_faturas_status ON faturas(status);
CREATE INDEX IF NOT EXISTS idx_faturas_data_vencimento ON faturas(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_faturas_created_at ON faturas(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_saques_cliente_id ON saques(cliente_id);
CREATE INDEX IF NOT EXISTS idx_saques_status ON saques(status);
CREATE INDEX IF NOT EXISTS idx_saques_created_at ON saques(created_at DESC);

-- Empréstimos
CREATE INDEX IF NOT EXISTS idx_emprestimos_cliente_id ON emprestimos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_emprestimos_status ON emprestimos(status);

-- Prestador Demandas (Adaptado de "demandas" pois não existe tabela apenas 'demandas')
CREATE INDEX IF NOT EXISTS idx_prestador_demandas_prestador_id ON prestador_demandas(prestador_id);
CREATE INDEX IF NOT EXISTS idx_prestador_demandas_status ON prestador_demandas(status);
CREATE INDEX IF NOT EXISTS idx_prestador_demandas_created_at ON prestador_demandas(created_at DESC);

-- Cobrancas
CREATE INDEX IF NOT EXISTS idx_cobrancas_cliente_id ON cobrancas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cobrancas_status ON cobrancas(status);

-- FKs Comuns Adicionais sugeridos
CREATE INDEX IF NOT EXISTS idx_prestador_faturas_prestador_id ON prestador_faturas(prestador_id);
CREATE INDEX IF NOT EXISTS idx_prestador_saques_prestador_id ON prestador_saques(prestador_id);
CREATE INDEX IF NOT EXISTS idx_fornecedor_produtos_fornecedor_id ON fornecedor_produtos(fornecedor_id);
