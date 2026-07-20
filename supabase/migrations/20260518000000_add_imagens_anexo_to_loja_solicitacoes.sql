-- Adiciona a coluna imagens_anexo à tabela loja_solicitacoes
ALTER TABLE public.loja_solicitacoes ADD COLUMN IF NOT EXISTS imagens_anexo jsonb DEFAULT '[]'::jsonb;

-- Habilita RLS na tabela loja_solicitacoes se não estiver habilitado
ALTER TABLE public.loja_solicitacoes ENABLE ROW LEVEL SECURITY;

-- Remove qualquer policy existente de acesso total para evitar conflitos
DROP POLICY IF EXISTS "Acesso total loja_solicitacoes" ON public.loja_solicitacoes;

-- Cria a policy de acesso total (permitindo select, insert, update, delete para todos)
CREATE POLICY "Acesso total loja_solicitacoes" ON public.loja_solicitacoes 
    FOR ALL 
    USING (true) 
    WITH CHECK (true);
