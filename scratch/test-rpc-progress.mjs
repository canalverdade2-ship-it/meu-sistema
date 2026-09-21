import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
psql "postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub" -c "
SELECT public.gsa_tv_get_job_progress('17aa5968-8311-49d9-af34-9b94a72ccb2e'::uuid);
"
`;
  const res = await runSshScript(script);
  console.log('JOB PROGRESS RESULT:\n', res.stdout);
}

main().catch(console.error);
