import { runSshScript } from './ssh2-run.mjs';

const cmd = `
DB_URL="postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub"
psql "$DB_URL" -c "
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'gsa_tv_programs'
ORDER BY ordinal_position;
"
`;

try {
  const res = await runSshScript(cmd, 30000);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
} catch (e) {
  console.error('ERROR:', e);
}
