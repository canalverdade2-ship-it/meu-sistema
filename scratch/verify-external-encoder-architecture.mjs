import { runSshScript } from './ssh2-run.mjs';

const script=String.raw`set -euo pipefail
cpdir=/opt/gsa-tv/control-plane
engdir=/opt/gsa-tv/encoder-engine
token=$(sudo awk -F= '$1=="ENCODER_ENGINE_TOKEN"{print substr($0,index($0,"=")+1);exit}' "$cpdir/.env")
dburl=$(sudo awk -F= '$1=="DATABASE_URL"{print substr($0,index($0,"=")+1);exit}' "$cpdir/.env")
status(){ curl -fsS -H "Authorization: Bearer $token" http://127.0.0.1:9210/v1/status; }
outer(){ status | python3 -c 'import json,sys;print(json.load(sys.stdin)["outer_pid"])'; }
producer(){ status | python3 -c 'import json,sys;print(json.load(sys.stdin)["producer_pid"])'; }
wait_ready(){
  for i in $(seq 1 75); do
    h=$(sudo docker inspect gsa-tv-control-plane --format '{{.State.Health.Status}}' 2>/dev/null || true)
    s=$(status 2>/dev/null || true)
    if [ "$h" = healthy ] && printf '%s' "$s" | grep -q '"outer_running":true' && printf '%s' "$s" | grep -q '"producer_running":true'; then return 0; fi
    sleep 1
  done
  return 1
}
job_wait(){
  id="$1"
  for i in $(seq 1 60); do
    row=$(sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -qAt -F '|' -c "select status,coalesce(error_message,''),coalesce(result::text,'') from public.gsa_tv_jobs where id='$id'")
    case "$row" in completed'|'*) echo "$row"; return 0;; failed'|'*) echo "$row"; return 1;; esac
    sleep 1
  done
  echo "$row"; return 1
}

sudo docker compose -p encoder-engine --project-directory "$engdir" -f "$engdir/compose.yml" up -d --force-recreate
for i in $(seq 1 30); do curl -fsS http://127.0.0.1:9210/health >/dev/null 2>&1 && break; sleep 1; done
sudo docker compose -p control-plane --project-directory "$cpdir" -f "$cpdir/compose.yml" up -d --force-recreate
wait_ready
base_outer=$(outer); base_producer=$(producer)
echo "baseline|outer=$base_outer|producer=$base_producer"

sudo docker compose -p control-plane --project-directory "$cpdir" -f "$cpdir/compose.yml" up -d --force-recreate >/dev/null
wait_ready
restart_outer=$(outer); restart_producer=$(producer)
test "$restart_outer" = "$base_outer"
test "$restart_producer" = "$base_producer"
echo "control_plane_restart|outer_same=true|producer_same=true|outer=$restart_outer"

gfx=$(sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -qAt -c "insert into public.gsa_tv_jobs(channel_id,job_type,status,progress,payload) values('ch-main','graphics_reload','pending',0,'{\"source\":\"external_encoder_proof\"}'::jsonb) returning id")
gfxrow=$(job_wait "$gfx")
test "$(outer)" = "$base_outer"
test "$(producer)" = "$base_producer"
echo "graphics_reload|$gfxrow|outer_same=true|producer_same=true"

program=$(sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -qAt -c "insert into public.gsa_tv_jobs(channel_id,job_type,status,progress,payload) values('ch-main','stream_start','pending',0,'{\"source\":\"external_encoder_switch_proof\"}'::jsonb) returning id")
programrow=$(job_wait "$program")
sleep 3
test "$(outer)" = "$base_outer"
program_producer=$(producer)
test "$program_producer" != "$base_producer"
echo "program_switch|$programrow|outer_same=true|producer_changed=true"

media=$(sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -qAt -c "insert into public.gsa_tv_jobs(channel_id,job_type,status,progress,payload) values('ch-main','media_take','pending',0,'{\"media_item_id\":\"media-gsa-agora-nature-narrated-v1\",\"source\":\"external_encoder_switch_proof\"}'::jsonb) returning id")
mediarow=$(job_wait "$media")
sleep 3
test "$(outer)" = "$base_outer"
test "$(producer)" != "$program_producer"
echo "media_switch|$mediarow|outer_same=true|producer_changed=true"

final=$(status)
echo "engine_status|$final"
echo "control_plane|$(sudo docker inspect gsa-tv-control-plane --format '{{.Config.Image}}|{{.State.Status}}|{{.State.Health.Status}}')"
echo "encoder_engine|$(sudo docker inspect gsa-tv-encoder-engine --format '{{.Config.Image}}|{{.State.Status}}|{{.State.Health.Status}}')"
echo "channel|$(sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -qAt -F '|' -c "select status,desired_state,playout_state,signal_state,coalesce(last_error,'') from public.gsa_tv_channels where id='ch-main'")"
echo "rtmp_processes|$(sudo docker top gsa-tv-encoder-engine -eo pid,args | grep -c '[r]tmp.*PROTECTED\|[r]tmp' || true)"
sudo docker logs --since 5m gsa-tv-encoder-engine 2>&1 | tail -30 | sed -E 's#rtmps?://[^ ]+#rtmp://[PROTECTED]#g'
`;
const result=await runSshScript(script,300000);
process.stdout.write(result.stdout); if(result.stderr) process.stderr.write(result.stderr);
