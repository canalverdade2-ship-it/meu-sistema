import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
psql "postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub" -c "
SELECT id, status, progress, current_stage, error_message, created_at, finished_at
FROM public.gsa_tv_jobs
WHERE id = 'e9786b12-4f63-450f-8e13-00cc5ffa1666';
"
`;
  const res = await runSshScript(script);
  console.log('JOB STATUS:\n', res.stdout);
}

main().catch(console.error);
