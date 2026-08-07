-- Migration: Tabela e Stored Procedures para Ramais de Transbordo Humano por Setor no WhatsApp
CREATE TABLE IF NOT EXISTS public.gsa_whatsapp_ramais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setor_nome VARCHAR(255) NOT NULL,
  codigo_setor VARCHAR(100) NOT NULL UNIQUE,
  numero_whatsapp VARCHAR(30) NOT NULL,
  responsavel_nome VARCHAR(255) NOT NULL,
  ativo BOOLEAN DEFAULT true,
  ordem INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices para buscas ultrarrapidas em tempo real pelo bot (n8n/Evolution)
CREATE INDEX IF NOT EXISTS idx_gsa_whatsapp_ramais_codigo ON public.gsa_whatsapp_ramais(codigo_setor);
CREATE INDEX IF NOT EXISTS idx_gsa_whatsapp_ramais_ativo ON public.gsa_whatsapp_ramais(ativo);

-- Permissoes RLS
ALTER TABLE public.gsa_whatsapp_ramais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura publica de ramais ativos" 
ON public.gsa_whatsapp_ramais FOR SELECT 
USING (true);

CREATE POLICY "Permitir gestao total por usuarios autenticados" 
ON public.gsa_whatsapp_ramais FOR ALL 
USING (auth.role() IN ('authenticated', 'service_role'));

-- Seeds Iniciais de Ramais por Setor
INSERT INTO public.gsa_whatsapp_ramais (setor_nome, codigo_setor, numero_whatsapp, responsavel_nome, ativo, ordem)
VALUES 
  ('1. Vendas & Orçamentos', 'vendas', '5511971858372', 'Equipe Comercial GSA', true, 1),
  ('2. Financeiro & Cobrança', 'financeiro', '5511971858372', 'Setor Financeiro', true, 2),
  ('3. Suporte Técnico & Operações', 'suporte_tecnico', '5511920857756', 'Central de Suporte GSA', true, 3),
  ('4. Diretoria & Atendimento Especial', 'diretoria', '5511971858372', 'Gestão & Diretoria', true, 4)
ON CONFLICT (codigo_setor) DO UPDATE 
SET 
  setor_nome = EXCLUDED.setor_nome,
  numero_whatsapp = EXCLUDED.numero_whatsapp,
  updated_at = NOW();
