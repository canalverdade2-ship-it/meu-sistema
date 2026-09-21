import fs from 'node:fs';
function patchFile(path, transform) {
  const before=fs.readFileSync(path,'utf8').replace(/\r\n/g,'\n');
  const after=transform(before);
  if(after===before) throw new Error(`no change: ${path}`);
  fs.writeFileSync(path,after,'utf8');
}
patchFile('scripts/validate-db-schema.cjs', s => s.replace(
`  const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL ||\n    'postgresql://supabase_admin:GSA_SENHA_FORTE_2026@147.15.43.141:5433/gsahub';\n\n  const client = new pg.Client({`,
`  const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;\n  if (!connectionString) return { isLive: false, liveError: 'Conexão PostgreSQL não configurada por variável de ambiente.' };\n\n  const client = new pg.Client({`));
for (const path of ['scripts/check-admin-migrations-runtime.cjs','scripts/check-collaborator-boundaries-runtime.cjs','scripts/check-site-campaign-migrations-runtime.cjs']) {
  patchFile(path, s => s.replace(
/const connection = \{\n  host: process\.env\.PGHOST \|\| '127\.0\.0\.1',\n  port: Number\(process\.env\.PGPORT \|\| 5432\),\n  user: process\.env\.PGUSER \|\| 'postgres',\n  password: process\.env\.PGPASSWORD \|\| 'postgres',\n\};/,
`const runtimeDatabaseUrl = process.env.ADMIN_RUNTIME_DB_URL || process.env.DATABASE_URL;\nif (!runtimeDatabaseUrl) {\n  console.log('[runtime-db] SKIP: defina ADMIN_RUNTIME_DB_URL para executar este teste no PostgreSQL da VPS/túnel (porta 5433).');\n  process.exit(0);\n}\nconst connection = { connectionString: runtimeDatabaseUrl };`));
}
console.log('SECURITY_SCRIPTS_PATCHED');
