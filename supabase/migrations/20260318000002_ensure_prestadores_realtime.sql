-- Ensure all prestador-related tables are in the real-time publication
DO $$
BEGIN
    -- Check if the publication exists
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        -- Add tables to the publication if they are not already there
        -- We use ALTER PUBLICATION ... ADD TABLE ...
        -- If a table is already in the publication, this might error, so we handle it gracefully
        
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE prestadores;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;

        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE prestador_demandas;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;

        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE prestador_faturas;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;

        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE prestador_documentos;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;

        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE prestador_historico;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;

        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE prestador_suporte_demandas;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;

        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE prestador_transacoes;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;

        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE prestador_saques;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;

        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE suporte_mensagens;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
    ELSE
        -- Create the publication if it doesn't exist (unlikely in Supabase but good practice)
        CREATE PUBLICATION supabase_realtime FOR TABLE 
            prestadores, 
            prestador_demandas, 
            prestador_faturas, 
            prestador_documentos, 
            prestador_historico, 
            prestador_suporte_demandas, 
            prestador_transacoes, 
            prestador_saques,
            suporte_mensagens;
    END IF;
END $$;
