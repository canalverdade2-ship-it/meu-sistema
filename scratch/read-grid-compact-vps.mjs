import { runSshScript } from './ssh2-run.mjs';

const result = await runSshScript(`set -Eeuo pipefail
DB_URL=$(sudo awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}' /opt/gsa-tv/control-plane/.env)
psql "$DB_URL" -X -At -F '|' -c "
select w.weekday,to_char(w.start_time,'HH24:MI'),to_char(w.end_time,'HH24:MI'),p.name,coalesce(w.segment_variant,''),w.content_mode
from public.gsa_tv_weekly_grid_slots w
join public.gsa_tv_programs p on p.id=w.program_id
where w.enabled and p.status='published'
order by w.weekday,w.start_time;"
`, 180000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
