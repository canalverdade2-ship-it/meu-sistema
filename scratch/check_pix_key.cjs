const { createClient } = require('@supabase/supabase-js');
const url = 'https://api.147-15-43-141.nip.io';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzczOTU2NDA5LCJleHAiOjIwODk1MzI0MDl9.05kQchOXKH2S062F8SJsb-bmnh3pni-RJE1P0jo0Igs';
const supabase = createClient(url, key);

async function run() {
  // Verify actual PIX EMV generation with empresa data
  // The company phone is (11) 92085-7754 = +5511920857754 (not 56 as in code)
  
  // Check the current hardcoded key vs the empresa phone
  console.log('=== PIX Key Analysis ===');
  console.log('Hardcoded in pixService.ts: +5511920857756');
  console.log('Empresa telefone:           (11) 92085-7754');
  console.log('Empresa phone cleaned:      +5511920857754');
  console.log('');
  console.log('DIFFERENCE: Last digit is 6 in code but empresa telefone ends in 54');
  console.log('This mismatch would cause PIX rejection if the PIX key is the phone number!');
  
  // Let's check all faturas with infinitepay data
  const { data: fats } = await supabase
    .from('faturas')
    .select('id, codigo_fatura, infinitepay_link, infinitepay_slug, status, valor_total')
    .not('infinitepay_link', 'is', null)
    .limit(5);
  
  console.log('\n=== Recent InfinitePay Faturas ===');
  fats?.forEach(f => {
    console.log(`${f.codigo_fatura}: status=${f.status}, valor=R$${f.valor_total}`);
    console.log(`  Link: ${f.infinitepay_link?.substring(0, 80)}...`);
  });
  
  // Check configuracoes table  
  const { data: configs } = await supabase.from('configuracoes').select('*').limit(20);
  console.log('\n=== Configuracoes Table ===');
  configs?.forEach(c => {
    const str = JSON.stringify(c);
    if (str.toLowerCase().includes('pix') || str.toLowerCase().includes('pay') || str.toLowerCase().includes('chave')) {
      console.log(JSON.stringify(c, null, 2));
    }
  });
  
  // Try configuracoes_financeiro  
  const { data: fin, error: finErr } = await supabase.from('configuracoes_financeiro').select('*').limit(5);
  if (!finErr && fin) {
    console.log('\n=== Configuracoes Financeiro ===');
    console.log(JSON.stringify(fin, null, 2));
  }
}

run().catch(console.error);
