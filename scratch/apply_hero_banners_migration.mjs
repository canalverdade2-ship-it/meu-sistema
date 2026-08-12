import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://api.147-15-43-141.nip.io';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzczOTU2NDA5LCJleHAiOjIwODk1MzI0MDl9.05kQchOXKH2S062F8SJsb-bmnh3pni-RJE1P0jo0Igs';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  console.log('📡 Testando conexão com a VPS (api.147-15-43-141.nip.io)...');
  
  // Testar se gsa_hero_banners já existe ou responde
  const { data, error } = await supabase
    .from('gsa_hero_banners')
    .select('*')
    .limit(5);

  if (error) {
    console.log('⚠️ Tabela gsa_hero_banners ainda não foi criada no Postgres da VPS.');
    console.log('Mensagem de erro:', error.message);
  } else {
    console.log('✅ Conexão bem sucedida! Registros na VPS:', data);
  }
}

testConnection();
