import { runSshScript } from './ssh2-run.mjs';
const script=String.raw`set -euo pipefail
dburl=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}'|awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
cmd=$(sudo docker top gsa-tv-control-plane -eo pid,args | grep -F 'rtmp://a.rtmp.youtube.com' | head -1)
logo_pos=$(printf '%s' "$cmd"|awk '{print index($0,"overlay=W-w-24:24:format=auto")}')
last_card_pos=$(printf '%s' "$cmd"|awk '{print index($0,"MERCADOS")}')
echo "filter_positions|last_card=$last_card_pos|logo=$logo_pos"
test "$logo_pos" -gt "$last_card_pos"
printf '%s\n' "$cmd" | grep -o 'scale=240:-1[^;]*;[^ ]*overlay=W-w-24:24:format=auto' | tail -1
sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -F '|' -c "select quality_profile,status,desired_state,playout_state,signal_state,coalesce(last_error,'') from public.gsa_tv_channels where id='ch-main';select id,status,coalesce(error_message,'') from public.gsa_tv_jobs where payload->>'source'='logo_topmost_absolute' order by created_at desc limit 1;"
sudo docker inspect gsa-tv-control-plane --format 'container={{.State.Status}}|health={{.State.Health.Status}}|image={{.Config.Image}}'
`;
const result=await runSshScript(script,60000);process.stdout.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);
