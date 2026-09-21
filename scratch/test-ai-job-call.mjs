import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
psql "postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub" -c "
SELECT public.gsa_admin_gsa_tv_mutate(
  NULL,
  NULL,
  'enqueue_job',
  '{\\"channel_id\\": \\"ch-main\\", \\"job_type\\": \\"ai_flow_vids_generate\\", \\"payload\\": {\\"test\\": true}}'::jsonb
);
"
`;
  const res = await runSshScript(script);
  console.log('OUTPUT:\n', res.stdout, res.stderr);
}

main().catch(console.error);
