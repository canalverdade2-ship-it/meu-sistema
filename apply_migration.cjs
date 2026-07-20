require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const migrationPath = process.argv[2];

if (!migrationPath) {
  console.error('Uso: node apply_migration.cjs <arquivo.sql>');
  process.exit(1);
}

const sqlPath = path.resolve(process.cwd(), migrationPath);
const sql = fs.readFileSync(sqlPath, 'utf8');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  const { error } = await supabase.rpc('execute_sql', { query: sql });
  if (error) {
    console.error(error);
    process.exit(1);
  }
  console.log(`Migration aplicada: ${migrationPath}`);
}

run();
