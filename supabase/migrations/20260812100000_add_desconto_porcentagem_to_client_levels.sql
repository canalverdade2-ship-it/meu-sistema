-- Adiciona a coluna desconto_porcentagem na tabela client_levels se não existir
ALTER TABLE public.client_levels 
ADD COLUMN IF NOT EXISTS desconto_porcentagem numeric(5,2) NOT NULL DEFAULT 0;

-- Atualizar valores padrao para os niveis oficiais
UPDATE public.client_levels SET desconto_porcentagem = 0 WHERE LOWER(nome_nivel) = 'basico' OR LOWER(nome_nivel) = 'básico';
UPDATE public.client_levels SET desconto_porcentagem = 2 WHERE LOWER(nome_nivel) = 'bronze';
UPDATE public.client_levels SET desconto_porcentagem = 5 WHERE LOWER(nome_nivel) = 'prata';
UPDATE public.client_levels SET desconto_porcentagem = 8 WHERE LOWER(nome_nivel) = 'ouro';
UPDATE public.client_levels SET desconto_porcentagem = 10 WHERE LOWER(nome_nivel) = 'diamante';
UPDATE public.client_levels SET desconto_porcentagem = 15 WHERE LOWER(nome_nivel) = 'black';
