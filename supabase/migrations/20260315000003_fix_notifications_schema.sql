-- Fix notificacoes table schema
ALTER TABLE notificacoes ALTER COLUMN cliente_id DROP NOT NULL;
ALTER TABLE notificacoes ADD COLUMN IF NOT EXISTS modulo TEXT;
ALTER TABLE notificacoes ADD COLUMN IF NOT EXISTS tab TEXT;
ALTER TABLE notificacoes ADD COLUMN IF NOT EXISTS item_id TEXT;
ALTER TABLE notificacoes ADD COLUMN IF NOT EXISTS data_criacao TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Enable realtime for notificacoes
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'notificacoes'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE notificacoes;
    END IF;
EXCEPTION WHEN undefined_object THEN
    CREATE PUBLICATION supabase_realtime FOR TABLE notificacoes;
END $$;
