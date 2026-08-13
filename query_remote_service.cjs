
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://api.147-15-43-141.nip.io', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRla3lsd2lweHl6bWdmbWZjc2dzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY4NjY2MzYxNywiZXhwIjoxOTAyMjM5NjE3fQ.Z609s_aPXZiJ60m6p32zS3qA2O5B3R4zZ-M2g8J6X9k');
async function run() {
  const { data, error } = await supabase.from('loja_carrinhos').select('*').limit(5);
  console.log('Cart Items (Service Role):', data);
  console.log('Error:', error);
}
run();
