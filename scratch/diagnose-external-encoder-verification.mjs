import { runSshScript } from './ssh2-run.mjs';
const script=String.raw`set -euo pipefail
cpdir=/opt/gsa-tv/control-plane
token=$(sudo awk -F= '$1=="ENCODER_ENGINE_TOKEN"{print substr($0,index($0,"=")+1);exit}' "$cpdir/.env")
dburl=$(sudo awk -F= '$1=="DATABASE_URL"{print substr($0,index($0,"=")+1);exit}' "$cpdir/.env")
echo ENGINE
curl -fsS -H "Authorization: Bearer $token" http://127.0.0.1:9210/v1/status
echo
echo CHANNEL
sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -qAt -F '|' -c "select status,desired_state,playout_state,signal_state,coalesce(last_error,'') from public.gsa_tv_channels where id='ch-main'"
echo JOBS
sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -qAt -F '|' -c "select id,job_type,status,coalesce(error_message,''),coalesce(result::text,'') from public.gsa_tv_jobs where channel_id='ch-main' order by created_at desc limit 6"
echo CONTAINERS
sudo docker inspect gsa-tv-control-plane gsa-tv-encoder-engine --format '{{.Name}}|{{.Config.Image}}|{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}|{{.RestartCount}}'
echo ENGINE_LOG
sudo docker logs --since 10m gsa-tv-encoder-engine 2>&1 | tail -50 | sed -E 's#rtmps?://[^ ]+#rtmp://[PROTECTED]#g'
echo CP_LOG
sudo docker logs --since 10m gsa-tv-control-plane 2>&1 | tail -50 | sed -E 's#rtmps?://[^ ]+#rtmp://[PROTECTED]#g'
`;
const r=await runSshScript(script,120000); process.stdout.write(r.stdout); process.stderr.write(r.stderr);
