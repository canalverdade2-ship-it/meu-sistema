-- Migration: adiciona documento (CPF/CNPJ) e form_data (dados do formulário) à tabela de desafios WhatsApp
-- Isso permite recuperar um cadastro em andamento ao digitar o CPF novamente, dentro do prazo de 5 minutos.

BEGIN;

ALTER TABLE public.gsa_provider_registration_challenges
  ADD COLUMN IF NOT EXISTS documento text,
  ADD COLUMN IF NOT EXISTS form_data jsonb;

-- Índice para busca rápida por CPF/CNPJ quando o cliente retorna
CREATE INDEX IF NOT EXISTS gsa_provider_registration_challenges_doc_idx
  ON public.gsa_provider_registration_challenges (documento, created_at DESC)
  WHERE documento IS NOT NULL;

COMMIT;
