require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase.rpc('execute_sql', {
    query: "ALTER TABLE ordens_assinatura DROP CONSTRAINT IF EXISTS ordens_assinatura_status_check; ALTER TABLE ordens_assinatura ADD CONSTRAINT ordens_assinatura_status_check CHECK (status IN ('em_analise', 'concluido', 'em_cancelamento', 'cancelado', 'pago'));"
  });
  console.log(error || 'Done');
}

run();
