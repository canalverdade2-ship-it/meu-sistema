import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo journalctl -u gsa-ai-producer.service -n 25 --no-pager
echo "--- RECENT JOBS ---"
psql "postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub" -c "
SELECT id, job_type, status, progress, current_stage, created_at, finished_at
FROM public.gsa_tv_jobs
WHERE job_type = 'ai_flow_vids_generate'
ORDER BY created_at DESC
LIMIT 3;
"
`;
  const res = await runSshScript(script);
  console.log('OUTPUT:\n', res.stdout);
}

main().catch(console.error);
