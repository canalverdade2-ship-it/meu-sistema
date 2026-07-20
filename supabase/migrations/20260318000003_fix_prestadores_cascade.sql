-- Script para garantir ON DELETE CASCADE em todas as tabelas que referenciam prestadores
-- Isso resolve problemas de exclusão bloqueada por restrições de chave estrangeira

DO $$ 
BEGIN
    -- 1. prestador_demandas
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prestador_demandas') THEN
        ALTER TABLE prestador_demandas DROP CONSTRAINT IF EXISTS prestador_demandas_prestador_id_fkey;
        ALTER TABLE prestador_demandas ADD CONSTRAINT prestador_demandas_prestador_id_fkey 
            FOREIGN KEY (prestador_id) REFERENCES prestadores(id) ON DELETE CASCADE;
    END IF;

    -- 2. prestador_faturas
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prestador_faturas') THEN
        ALTER TABLE prestador_faturas DROP CONSTRAINT IF EXISTS prestador_faturas_prestador_id_fkey;
        ALTER TABLE prestador_faturas ADD CONSTRAINT prestador_faturas_prestador_id_fkey 
            FOREIGN KEY (prestador_id) REFERENCES prestadores(id) ON DELETE CASCADE;
    END IF;

    -- 3. prestador_documentos
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prestador_documentos') THEN
        ALTER TABLE prestador_documentos DROP CONSTRAINT IF EXISTS prestador_documentos_prestador_id_fkey;
        ALTER TABLE prestador_documentos ADD CONSTRAINT prestador_documentos_prestador_id_fkey 
            FOREIGN KEY (prestador_id) REFERENCES prestadores(id) ON DELETE CASCADE;
    END IF;

    -- 4. prestador_historico
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prestador_historico') THEN
        ALTER TABLE prestador_historico DROP CONSTRAINT IF EXISTS prestador_historico_prestador_id_fkey;
        ALTER TABLE prestador_historico ADD CONSTRAINT prestador_historico_prestador_id_fkey 
            FOREIGN KEY (prestador_id) REFERENCES prestadores(id) ON DELETE CASCADE;
    END IF;

    -- 5. tickets
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'prestador_id') THEN
        ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_prestador_id_fkey;
        ALTER TABLE tickets ADD CONSTRAINT tickets_prestador_id_fkey 
            FOREIGN KEY (prestador_id) REFERENCES prestadores(id) ON DELETE CASCADE;
    END IF;

    -- 6. prestador_suporte_demandas
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prestador_suporte_demandas') THEN
        ALTER TABLE prestador_suporte_demandas DROP CONSTRAINT IF EXISTS prestador_suporte_demandas_prestador_id_fkey;
        ALTER TABLE prestador_suporte_demandas ADD CONSTRAINT prestador_suporte_demandas_prestador_id_fkey 
            FOREIGN KEY (prestador_id) REFERENCES prestadores(id) ON DELETE CASCADE;
    END IF;

    -- 7. prestador_transacoes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prestador_transacoes') THEN
        ALTER TABLE prestador_transacoes DROP CONSTRAINT IF EXISTS prestador_transacoes_prestador_id_fkey;
        ALTER TABLE prestador_transacoes ADD CONSTRAINT prestador_transacoes_prestador_id_fkey 
            FOREIGN KEY (prestador_id) REFERENCES prestadores(id) ON DELETE CASCADE;
    END IF;

    -- 8. prestador_saques
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prestador_saques') THEN
        ALTER TABLE prestador_saques DROP CONSTRAINT IF EXISTS prestador_saques_prestador_id_fkey;
        ALTER TABLE prestador_saques ADD CONSTRAINT prestador_saques_prestador_id_fkey 
            FOREIGN KEY (prestador_id) REFERENCES prestadores(id) ON DELETE CASCADE;
    END IF;

END $$;
