
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://api.147-15-43-141.nip.io', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzczOTU2NDA5LCJleHAiOjIwODk1MzI0MDl9.05kQchOXKH2S062F8SJsb-bmnh3pni-RJE1P0jo0Igs');
async function run() {
  const { data, error } = await supabase.from('loja_carrinhos').select('*').limit(5);
  console.log('Cart Items:', data);
  console.log('Error:', error);
}
run();
