const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://api.147-15-43-141.nip.io', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzczOTU2NDA5LCJleHAiOjIwODk1MzI0MDl9.05kQchOXKH2S062F8SJsb-bmnh3pni-RJE1P0jo0Igs');

async function check() {
  const { data, error } = await supabase.from('produtos').select('id').range(0, 5000);
  if (error) console.error(error);
  console.log('Fetched:', data ? data.length : 0);
}
check();