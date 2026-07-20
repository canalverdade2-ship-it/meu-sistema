-- Add comprovante_concorrente to orcamentos
ALTER TABLE public.orcamentos 
ADD COLUMN IF NOT EXISTS comprovante_concorrente text;
