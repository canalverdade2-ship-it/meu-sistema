const { createClient } = require('@supabase/supabase-js');
const url = 'https://api.147-15-43-141.nip.io';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzczOTU2NDA5LCJleHAiOjIwODk1MzI0MDl9.05kQchOXKH2S062F8SJsb-bmnh3pni-RJE1P0jo0Igs';
const supabase = createClient(url, key);

async function run() {
  // Check empresa table for PIX key and InfinitePay config
  const { data: empresa, error } = await supabase.from('empresa').select('*').limit(1).single();
  console.log('EMPRESA DATA:');
  console.log(JSON.stringify(empresa, null, 2));
  
  // Check if there's a chave_pix field
  if (empresa) {
    const pixFields = Object.entries(empresa).filter(([k, v]) => 
      k.toLowerCase().includes('pix') || 
      k.toLowerCase().includes('infinitepay') || 
      k.toLowerCase().includes('chave') ||
      k.toLowerCase().includes('banco') ||
      k.toLowerCase().includes('pagamento') ||
      k.toLowerCase().includes('checkout')
    );
    console.log('\nPIX-related fields:');
    pixFields.forEach(([k, v]) => console.log(`  ${k}: ${JSON.stringify(v)}`));
  }
}

run().catch(console.error);
