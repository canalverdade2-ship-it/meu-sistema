import { runSshScript } from './ssh2-run.mjs';
const script=String.raw`set -euo pipefail
dburl=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}'|awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -F '|' -c "
select id,title,state,approval_state,rights_ok,duration_s,drive_path,metadata
from public.gsa_tv_media_items
where state='ready' and approval_state='approved' and rights_ok
  and (title ilike '%nature%' or title ilike '%natureza%' or title ilike '%paisagem%' or title ilike '%floresta%' or title ilike '%oceano%' or title ilike '%cachoeira%' or metadata::text ilike '%nature%')
order by created_at desc limit 40;"
echo 'filesystem_candidates'
sudo find /opt/gsa-tv/cache/media -type f \( -iname '*nature*' -o -iname '*natureza*' -o -iname '*forest*' -o -iname '*ocean*' -o -iname '*waterfall*' -o -iname '*paisagem*' \) -printf '%p|%s\n' | head -80
`;
const result=await runSshScript(script,90000);process.stdout.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);
