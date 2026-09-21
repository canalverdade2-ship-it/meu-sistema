'use strict';
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf8');
let supabaseUrl = '';
let supabaseKey = '';
for (const line of envFile.split('\n')) {
  if (line.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim().replace(/^["']|["']$/g, '');
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].trim().replace(/^["']|["']$/g, '');
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConfig() {
  const { data: config, error: err1 } = await supabase.from('configuracoes_gerais').select('*');
  console.log('configuracoes_gerais:', config, err1);

  const { data: emp, error: err2 } = await supabase.from('empresa_config').select('*');
  console.log('empresa_config:', emp, err2);

  const { data: tables, error: err3 } = await supabase.from('configuracoes').select('*');
  console.log('configuracoes:', tables, err3);
}

checkConfig();
