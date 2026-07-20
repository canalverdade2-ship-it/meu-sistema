-- Garantir que a tabela de histórico tenha RLS e políticas de acesso
DO $$ 
BEGIN
    -- Verificar se a tabela existe
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'prestador_demandas_historico') THEN
        
        -- Habilitar RLS
        ALTER TABLE public.prestador_demandas_historico ENABLE ROW LEVEL SECURITY;

        -- Remover políticas antigas se existirem
        DROP POLICY IF EXISTS "Acesso total prestador_demandas_historico" ON public.prestador_demandas_historico;
        DROP POLICY IF EXISTS "Permitir leitura para usuários autenticados" ON public.prestador_demandas_historico;
        DROP POLICY IF EXISTS "Permitir inserção para usuários autenticados" ON public.prestador_demandas_historico;

        -- Criar política de leitura (Select)
        CREATE POLICY "Permitir leitura para usuários autenticados" 
        ON public.prestador_demandas_historico 
        FOR SELECT 
        TO authenticated 
        USING (true);

        -- Criar política de inserção (Insert)
        CREATE POLICY "Permitir inserção para usuários autenticados" 
        ON public.prestador_demandas_historico 
        FOR INSERT 
        TO authenticated 
        WITH CHECK (true);

        -- Garantir permissões de uso
        GRANT ALL ON public.prestador_demandas_historico TO authenticated;
        GRANT ALL ON public.prestador_demandas_historico TO service_role;

    END IF;
END $$;
