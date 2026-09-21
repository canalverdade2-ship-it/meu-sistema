import { runSshScript } from './ssh2-run.mjs';

const cmd = `
DB_URL="postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub"
psql "$DB_URL" -x -c "SELECT * FROM public.gsa_tv_jobs WHERE id IN ('073c7463-32bf-4d29-aedd-27f1c0a25237', '7b050a52-9b93-4afe-91c1-8aea3d1607e5', 'f341c076-a040-403b-9236-7ef31244070b');"
`;

try {
  const res = await runSshScript(cmd, 30000);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
} catch (e) {
  console.error('ERROR:', e);
}
