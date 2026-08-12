import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://api.147-15-43-141.nip.io';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzczOTU2NDA5LCJleHAiOjIwODk1MzI0MDl9.05kQchOXKH2S062F8SJsb-bmnh3pni-RJE1P0jo0Igs';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSiteCampaigns() {
  const { data, error } = await supabase
    .from('gsa_site_campaigns')
    .select('*')
    .limit(5);

  if (error) {
    console.error('❌ gsa_site_campaigns error:', error.message);
  } else {
    console.log('✅ gsa_site_campaigns existe! Conteúdo:', data);
  }
}

checkSiteCampaigns();
