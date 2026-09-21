import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
psql "postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub" -c "
SELECT id, job_type, payload
FROM public.gsa_tv_jobs
WHERE id = '2101fcb6-5817-40f8-b044-821a00143208';
"
`;
  const res = await runSshScript(script);
  console.log('PAYLOAD:\n', res.stdout);
}

main().catch(console.error);
