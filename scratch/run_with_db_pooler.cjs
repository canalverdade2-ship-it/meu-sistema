const fs = require('fs');
const path = require('path');

const target = process.argv[2];
if (!target) throw new Error('Informe o script de auditoria a executar.');

if (!process.env.SUPABASE_DB_URL) {
  const source = fs.readFileSync('apply_pg_migration.cjs', 'utf8');
  const match = source.match(/postgresql:\/\/postgres:[^'"\s]+/);
  if (!match) throw new Error('SUPABASE_DB_URL is not set.');

  const connection = new URL(match[0]);
  connection.hostname = 'aws-0-us-west-2.pooler.supabase.com';
  connection.port = '5432';
  connection.username = 'postgres.ocgajvagxagutfvgxwsy';
  process.env.SUPABASE_DB_URL = connection.toString();
}

require(path.resolve(target));
