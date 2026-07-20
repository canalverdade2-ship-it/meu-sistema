CREATE TABLE prestador_agendamentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prestador_id UUID REFERENCES prestadores(id) ON DELETE CASCADE,
  demanda_id UUID REFERENCES prestador_demandas(id) ON DELETE SET NULL,
  data_inicio TIMESTAMPTZ NOT NULL,
  data_fim TIMESTAMPTZ NOT NULL,
  observacoes TEXT,
  status TEXT NOT NULL DEFAULT 'agendado' CHECK (status IN ('agendado', 'concluido')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE prestador_agendamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso total aos agendamentos"
  ON prestador_agendamentos
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT ALL ON prestador_agendamentos TO anon, authenticated;
