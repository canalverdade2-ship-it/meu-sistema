import { runSshScript } from './ssh2-run.mjs';
const script = `
DB_URL=$(sudo awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}' /opt/gsa-tv/control-plane/.env)
echo "=== Schedule Version ==="
psql "$DB_URL" -X -c "SELECT id, broadcast_date, version, state, title FROM public.gsa_tv_schedule_versions WHERE id='003801b7-5f2d-4da3-a531-915ce52a27f3';"
echo "=== Program Blocks for 003801b7-5f2d-4da3-a531-915ce52a27f3 ==="
psql "$DB_URL" -X -c "SELECT position, title, start_time, duration_seconds, media_item_id, status FROM public.gsa_tv_program_blocks WHERE schedule_version_id='003801b7-5f2d-4da3-a531-915ce52a27f3' ORDER BY position;"
echo "=== AI Projects for 10/09 ==="
psql "$DB_URL" -X -c "SELECT id, name, project_type, state, autonomy_mode, metadata->>'editorial_block_id' as block_id FROM public.gsa_tv_ai_projects WHERE created_at >= '2026-09-09' ORDER BY created_at DESC LIMIT 30;"
`;
const res = await runSshScript(script, 60000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
