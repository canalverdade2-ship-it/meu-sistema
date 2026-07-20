-- Adiciona a coluna descricao_detalhada à tabela loja_solicitacoes
ALTER TABLE public.loja_solicitacoes ADD COLUMN IF NOT EXISTS descricao_detalhada text;
