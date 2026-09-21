import { runSshScript } from './ssh2-run.mjs';

async function testWorkerExecution() {
  console.log('Enqueuing a test job to see the worker execute automatically...');
  const script = `
psql "postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub" -c "
INSERT INTO public.gsa_tv_jobs (channel_id, job_type, status, progress, current_stage, payload)
VALUES ('ch-main', 'ai_flow_vids_generate', 'pending', 0, 'Aguardando worker...', '{\\"preset_id\\": \\"gsa_interprogramas\\", \\"title\\": \\"Chamadas A Seguir & Minuto GSA\\"}')
RETURNING id;
"
sleep 6
sudo journalctl -u gsa-ai-producer.service -n 25 --no-pager
`;
  const res = await runSshScript(script);
  console.log('OUTPUT:\n', res.stdout, res.stderr);
}

testWorkerExecution().catch(console.error);
