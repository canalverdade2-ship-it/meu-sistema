import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: rb, error } = await supabase.from('loja_reembolsos').update({ status: 'pago', data_pagamento: new Date().toISOString(), observacoes_pagamento: 'Reembolsado automaticamente (Saldo/Pontos/Cupom).' }).eq('codigo_reembolso', 'REEMB-1780426547976');
  console.log("Fixed!", rb, error);
}
run();
