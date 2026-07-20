import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const env = fs.readFileSync(path.resolve('.env'), 'utf8');
const url = env.match(/VITE_SUPABASE_URL=([^\r\n]+)/)[1].replace(/['"]/g, '');
const key = env.match(/VITE_SUPABASE_ANON_KEY=([^\r\n]+)/)[1].replace(/['"]/g, '');
const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.from('faturas').insert([{
    codigo_fatura: 'FAT-TEST',
    cliente_id: '1484e6b6-fee4-4c2b-8c28-e7e64879cd78',
    valor_total: 20,
    status: 'pendente',
    loja_credito_solicitacao_id: '640cbb28-7ff9-401e-8cd6-1372345a603d',
    data_vencimento: new Date().toISOString()
  }]);
  
  if (error) {
    console.error('ERROR:', error);
  } else {
    console.log('SUCCESS:', data);
  }
}

run();
