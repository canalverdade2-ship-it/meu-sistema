require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: orc } = await supabase.from('orcamentos').select('*').eq('codigo_orcamento', '#ODC-0118').single();
  const { data: ordem } = await supabase.from('ordens_assinatura').select('*').eq('orcamento_id', orc.id).single();
  const { data: ass } = await supabase.from('assinaturas').select('*').eq('id', ordem.assinatura_id).single();

  const { error } = await supabase.from('faturas').insert([{
    codigo_fatura: 'FAT-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
    ordem_assinatura_id: ordem.id,
    cliente_id: orc.cliente_id,
    valor_total: ass.valor,
    valor_final_pendente: 0,
    status: 'pago',
    tipo: 'assinatura',
    data_vencimento: new Date().toISOString().split('T')[0],
    data_pagamento: new Date().toISOString(),
    forma_pagamento_escolhida: 'credito_loja'
  }]);
  console.log(error || 'Inserted Fatura');
}

run();
