import { runSshScript } from './ssh2-run.mjs';
const script = `
DB_URL=$(sudo awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}' /opt/gsa-tv/control-plane/.env)
psql "$DB_URL" -X -P pager=off -c "
SELECT 
  b.position,
  p.name as program_name,
  b.planned_start_offset_s,
  to_char((interval '1 second' * b.planned_start_offset_s), 'HH24:MI:SS') as start_time,
  b.planned_duration_s,
  b.media_item_id,
  b.notes,
  b.id as block_id
FROM public.gsa_tv_program_blocks b
LEFT JOIN public.gsa_tv_programs p ON p.id = b.program_id
WHERE b.schedule_version_id = '003801b7-5f2d-4da3-a531-915ce52a27f3'
ORDER BY b.position;
"
`;
const res = await runSshScript(script, 60000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
