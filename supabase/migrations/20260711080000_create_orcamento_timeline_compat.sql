CREATE TABLE IF NOT EXISTS public.orcamento_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id UUID,
  cliente_id UUID,
  ator_id UUID,
  ator_tipo TEXT,
  tipo TEXT,
  acao TEXT,
  status TEXT,
  titulo TEXT,
  descricao TEXT,
  detalhes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.orcamento_timeline
  ADD COLUMN IF NOT EXISTS orcamento_id UUID,
  ADD COLUMN IF NOT EXISTS cliente_id UUID,
  ADD COLUMN IF NOT EXISTS ator_id UUID,
  ADD COLUMN IF NOT EXISTS ator_tipo TEXT,
  ADD COLUMN IF NOT EXISTS tipo TEXT,
  ADD COLUMN IF NOT EXISTS acao TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS titulo TEXT,
  ADD COLUMN IF NOT EXISTS descricao TEXT,
  ADD COLUMN IF NOT EXISTS detalhes TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_orcamento_timeline_orcamento_id
  ON public.orcamento_timeline (orcamento_id);

CREATE INDEX IF NOT EXISTS idx_orcamento_timeline_cliente_id
  ON public.orcamento_timeline (cliente_id);

ALTER TABLE public.orcamento_timeline ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orcamento_timeline_select_authenticated" ON public.orcamento_timeline;
CREATE POLICY "orcamento_timeline_select_authenticated"
  ON public.orcamento_timeline
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "orcamento_timeline_insert_authenticated" ON public.orcamento_timeline;
CREATE POLICY "orcamento_timeline_insert_authenticated"
  ON public.orcamento_timeline
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orcamento_timeline TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orcamento_timeline TO anon;
GRANT ALL ON public.orcamento_timeline TO service_role;
