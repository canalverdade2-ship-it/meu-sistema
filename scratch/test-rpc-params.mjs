import { runSshScript } from './ssh2-run.mjs';

async function test() {
  const script = `
psql "postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub" -c "
SELECT public.gsa_tv_get_recent_ai_jobs(null, null);
"
`;
  const res = await runSshScript(script);
  console.log('OUTPUT:\n', res.stdout);
}

test().catch(console.error);
