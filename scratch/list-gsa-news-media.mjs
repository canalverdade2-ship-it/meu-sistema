import { runSshScript } from './ssh2-run.mjs';
const result=await runSshScript(`set -eu
database_url=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
sudo docker run --rm --network host postgres:15-alpine psql "$database_url" -X -At -F '|' -c "
select id,title,state,coalesce(approval_state::text,''),rights_ok,round(duration_s::numeric,1),drive_path,created_at
from public.gsa_tv_media_items
where lower(id||' '||coalesce(title,'')) like '%gsa%news%'
order by created_at desc nulls last;"
`,30000);
process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');
