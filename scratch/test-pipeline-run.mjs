import { runSshScript } from './ssh2-run.mjs';

async function testQueuedExecution() {
  console.log('Inserting a queued job for gsa_interprogramas...');
  const script = `
psql "postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub" -c "
INSERT INTO public.gsa_tv_jobs (channel_id, job_type, status, progress, current_stage, payload)
VALUES ('ch-main', 'ai_flow_vids_generate', 'queued', 0, 'Fila de producao...', '{\\"preset_id\\": \\"gsa_interprogramas\\", \\"title\\": \\"Chamadas A Seguir & Minuto GSA\\"}')
RETURNING id;
"
echo "Waiting 12 seconds for production pipeline..."
sleep 12
sudo journalctl -u gsa-ai-producer.service -n 35 --no-pager
`;
  const res = await runSshScript(script);
  console.log('OUTPUT:\n', res.stdout, res.stderr);
}

testQueuedExecution().catch(console.error);
