import { runSshScript } from './ssh2-run.mjs';

const cmd = `
DB_URL="postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub"
psql "$DB_URL" -c "
SELECT pb.id, p.name, pb.media_item_id, m.title, pb.planned_start_offset_s, pb.planned_duration_s
  FROM public.gsa_tv_program_blocks pb
  JOIN public.gsa_tv_programs p ON p.id = pb.program_id
  LEFT JOIN public.gsa_tv_media_items m ON m.id = pb.media_item_id
 WHERE pb.schedule_version_id = '003801b7-5f2d-4da3-a531-915ce52a27f3'
 ORDER BY pb.planned_start_offset_s;
"
`;

try {
  const res = await runSshScript(cmd, 30000);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
} catch (e) {
  console.error('ERROR:', e);
}
