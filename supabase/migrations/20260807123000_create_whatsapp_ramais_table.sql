-- Migration: Tabela e Seeds Reais do Chatbot em Produção para Ramais de Transbordo Humano por Setor no WhatsApp
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

-- Indices para buscas em tempo real pelo bot n8n/webhook
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

-- Seeds 100% REAIS DO CHATBOT EM PRODUÇÃO (Opções 1, 2, 3, 5, 6, 7, 8 do Bot WhatsApp)
INSERT INTO public.gsa_whatsapp_ramais (setor_nome, codigo_setor, numero_whatsapp, responsavel_nome, ativo, ordem)
VALUES 
  ('1️⃣ Comercial', 'comercial', '5511971858372', 'COMERCIAL GSA', true, 1),
  ('2️⃣ Financeiro', 'financeiro', '5511971858372', 'FINANCEIRO GSA', true, 2),
  ('3️⃣ Dep. Pessoal', 'dep_pessoal', '5511971858372', 'DEP. PESSOAL GSA', true, 3),
  ('5️⃣ Suporte Afiliados', 'suporte_afiliados', '5511920857756', 'SUPORTE AFILIADOS GSA', true, 5),
  ('6️⃣ Suporte Parceiros', 'suporte_parceiros', '5511920857756', 'SUPORTE PARCEIROS GSA', true, 6),
  ('7️⃣ Suporte Fornecedores', 'suporte_fornecedores', '5511920857756', 'SUPORTE FORNECEDORES GSA', true, 7),
  ('8️⃣ SAC', 'sac', '5511971858372', 'SAC GSA', true, 8)
ON CONFLICT (codigo_setor) DO UPDATE 
SET 
  setor_nome = EXCLUDED.setor_nome,
  numero_whatsapp = EXCLUDED.numero_whatsapp,
  responsavel_nome = EXCLUDED.responsavel_nome,
  updated_at = NOW();
