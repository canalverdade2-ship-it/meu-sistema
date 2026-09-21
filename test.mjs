import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase.from('orcamentos').select('*, cupom_desconto:cupons_loja!orcamentos_cupom_desconto_id_fkey(codigo_cupom)').limit(1);
  if (error) {
    const { data: d2, error: e2 } = await supabase.from('orcamentos').select('*, cupom_desconto:cupons_loja!fk_orcamentos_cupom_desconto(codigo_cupom)').limit(1);
    console.log("e2:", e2?.message || "success!");
  } else {
    console.log("success!");
  }
}
run();
