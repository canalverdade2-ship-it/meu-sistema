const { createClient } = require('@supabase/supabase-js');
const url = 'https://api.147-15-43-141.nip.io';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzczOTU2NDA5LCJleHAiOjIwODk1MzI0MDl9.05kQchOXKH2S062F8SJsb-bmnh3pni-RJE1P0jo0Igs';
const supabase = createClient(url, key);

async function check() {
  const { data, error } = await supabase.from('system_settings').select('*').like('key', '%whatsapp%');
  console.log('WhatsApp system_settings:', data, error);
}

check().catch(console.error);
