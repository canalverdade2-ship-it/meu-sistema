import { runSshScript } from './ssh2-run.mjs';

const cmd = `
DB_URL="postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub"
psql "$DB_URL" -c "
SELECT id, name, state, autonomy_mode,
       metadata->>'broadcast_date' as b_date,
       metadata->>'editorial_prepared' as ed_prep,
       metadata->>'fact_check_status' as fc_status,
       metadata->>'production_package_ready' as pkg_ready
  FROM public.gsa_tv_ai_projects
 WHERE metadata->>'editorial_block_id' IN (
   SELECT id::text FROM public.gsa_tv_program_blocks
    WHERE schedule_version_id='003801b7-5f2d-4da3-a531-915ce52a27f3'
 );
"
`;

try {
  const res = await runSshScript(cmd, 30000);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
} catch (e) {
  console.error('ERROR:', e);
}
