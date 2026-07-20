const fs = require('fs');

const source = fs.readFileSync('apply_pg_migration.cjs', 'utf8');
const match = source.match(/postgresql:\/\/postgres:[^'"\s]+/);

if (!match) {
  throw new Error('Database URL fallback was not found. Set SUPABASE_DB_URL instead.');
}

const connection = new URL(match[0]);
connection.hostname = 'aws-0-us-west-2.pooler.supabase.com';
connection.port = '5432';
connection.username = 'postgres.ocgajvagxagutfvgxwsy';

process.env.SUPABASE_DB_URL = connection.toString();
require('./live_db_audit.cjs');
