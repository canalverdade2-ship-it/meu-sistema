import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const env = fs.readFileSync(path.resolve('.env'), 'utf8');
const url = env.match(/VITE_SUPABASE_URL=([^\r\n]+)/)[1].replace(/['"]/g, '');
const key = env.match(/VITE_SUPABASE_ANON_KEY=([^\r\n]+)/)[1].replace(/['"]/g, '');
const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.from('faturas').select('*').limit(1);
  console.log(Object.keys(data[0] || {}));
}

run();
