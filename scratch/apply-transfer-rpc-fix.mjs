import fs from 'node:fs';
import pg from 'pg';

const creds = fs.readFileSync(new URL('../CREDENCIAIS_SISTEMA_GSA.md', import.meta.url), 'utf8');
const passwordMatch = creds.match(/Senha Master:\*\*\s*`([^`]+)`/i);
if (!passwordMatch) throw new Error('Senha do banco nao localizada.');
const sql = fs.readFileSync(new URL('../supabase/migrations/20260828223000_fix_affiliate_transfer_rpc_exposure.sql', import.meta.url), 'utf8');
const client = new pg.Client({ host: '147.15.43.141', port: 5433, database: 'gsahub', user: 'supabase_admin', password: passwordMatch[1], connectionTimeoutMillis: 5000 });
try {
  await client.connect();
  await client.query(sql);
  const result = await client.query("select p.proname, has_function_privilege('anon', p.oid, 'EXECUTE') anon_execute from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('gsa_client_lookup_affiliate_transfer_target','gsa_client_transfer_affiliate_balance','gsa_client_affiliate_transfers') order by p.proname");
  console.log(JSON.stringify(result.rows));
} finally {
  await client.end().catch(() => {});
}
