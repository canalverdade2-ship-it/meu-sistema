require('dotenv').config();

const { Client } = require('pg');

const connectionString = process.env.SUPABASE_DB_URL;

if (!connectionString) {
  throw new Error('Defina SUPABASE_DB_URL no ambiente antes de executar esta migration.');
}

const client = new Client({
  connectionString,
  ssl: false,
});

async function run() {
  try {
    await client.connect();
    
    // Add columns
    await client.query(`
      ALTER TABLE public.parceiros_resgates ADD COLUMN IF NOT EXISTS alerta_duplicidade BOOLEAN DEFAULT FALSE;
      ALTER TABLE public.parceiros_resgates ADD COLUMN IF NOT EXISTS justificativa_duplicidade TEXT;
      ALTER TABLE public.parceiros_resgates ADD COLUMN IF NOT EXISTS motivo_recusa TEXT;
    `);
    
    // Drop existing constraint if any and add the new one
    // It's possible the status column doesn't have a constraint but relies on an ENUM. Let's see if it's an ENUM or constraint.
    // We will drop and recreate the constraint just in case. If it's a constraint check:
    await client.query(`
      DO $$
      BEGIN
        BEGIN
          ALTER TABLE public.parceiros_resgates DROP CONSTRAINT IF EXISTS parceiros_resgates_status_check;
        EXCEPTION
          WHEN undefined_object THEN
            -- do nothing
        END;
        
        ALTER TABLE public.parceiros_resgates 
        ADD CONSTRAINT parceiros_resgates_status_check 
        CHECK (status IN ('pendente', 'aprovado', 'rejeitado', 'concluido', 'analise', 'recusado', 'cancelado', 'usado'));
      END $$;
    `);

    // Run NOTIFY pgrst
    await client.query(`NOTIFY pgrst, 'reload schema'`);
    
    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

run();
