import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  // Try to find the faturas for the specific ordem_compra code "OC-57054469"
  const { data: oc } = await supabase.from('ordens_compra').select('*').eq('codigo_ordem', 'OC-57054469').single();
  if (oc) {
    console.log("Ordem Compra:", oc);
    const { data: faturas } = await supabase.from('faturas').select('*, pagamentos(*)').eq('ordem_compra_id', oc.id);
    console.log("Faturas da Ordem Compra:", JSON.stringify(faturas, null, 2));
    
    // what about orcamento?
    const { data: faturasOrcamento } = await supabase.from('faturas').select('*, pagamentos(*)').eq('codigo_fatura', '???'); // just checking if fatura is linked to orcamento
  }
  
  const { data: reembolsos } = await supabase.from('loja_reembolsos').select('*').limit(2);
  console.log("Reembolsos:", JSON.stringify(reembolsos, null, 2));
}
run();
