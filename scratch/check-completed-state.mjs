import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
psql "postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub" -c "
SELECT id, status, progress, current_stage, payload->>'preset_id' as preset, created_at, finished_at
FROM public.gsa_tv_jobs
WHERE job_type = 'ai_flow_vids_generate'
ORDER BY created_at DESC
LIMIT 5;
"
`;
  const res = await runSshScript(script);
  console.log('OUTPUT:\n', res.stdout);
}

main().catch(console.error);
