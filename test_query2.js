import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const ordemCompraId = '14552e36-aa0e-4667-843b-779604bbdaf7'; // From the console output
  
  const { data: faturas } = await supabase.from('faturas').select('*, pagamentos(*)').eq('ordem_compra_id', ordemCompraId);
  console.log("Faturas da Ordem Compra:", JSON.stringify(faturas, null, 2));

  // let's see if faturas is linked through orcamento_id instead? Wait, faturas have orcamento_id? No, fatura schema says: os_id, ordem_compra_id, ordem_assinatura_id.
  
  // if not, let's find the fatura using other means, maybe by querying all faturas of this client?
  const { data: allFaturas } = await supabase.from('faturas').select('id, codigo_fatura, ordem_compra_id, os_id, ordem_assinatura_id, valor_total').eq('cliente_id', '262b0425-2e4b-49b7-9765-db1510e2a664');
  console.log("All faturas from this client:", allFaturas);
}
run();
