CREATE TABLE IF NOT EXISTS promocoes_quantidade_ativadas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
  promocao_quantidade_id UUID REFERENCES promocoes_quantidade(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cliente_id, promocao_quantidade_id)
);
