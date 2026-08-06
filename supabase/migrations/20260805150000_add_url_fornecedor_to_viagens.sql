-- Migration to add url_fornecedor to viagens_pacotes
ALTER TABLE public.viagens_pacotes ADD COLUMN IF NOT EXISTS url_fornecedor TEXT;
