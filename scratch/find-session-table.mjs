import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
psql "postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub" -c "select table_name from information_schema.tables where table_name like '%sess%' or table_name like '%admin%';"
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
