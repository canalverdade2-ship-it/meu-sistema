import { runSshScript } from './ssh2-run.mjs';
const result=await runSshScript(`set -euo pipefail
media_id='media-gsa-news-2026-09-01-broadcast-v4-final'
database_url=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
engine_token=$(sudo awk -F= '$1=="ENCODER_ENGINE_TOKEN"{print substr($0,index($0,"=")+1);exit}' /opt/gsa-tv/control-plane/.env)
engine_status(){ curl -fsS -H "Authorization: Bearer $engine_token" http://127.0.0.1:9210/v1/status; }
outer_before=$(engine_status | python3 -c 'import json,sys; print(json.load(sys.stdin)["outer_pid"])')
gate=$(sudo docker run --rm --network host postgres:15-alpine psql "$database_url" -X -qAt -F '|' -c "select state,approval_state,rights_ok,round(duration_s::numeric,1),drive_path from public.gsa_tv_media_items where id='$media_id'")
echo "gate|$gate"
case "$gate" in ready'|'approved'|'t'|'*) ;; *) echo 'media_gate_failed'; exit 1;; esac
media_path=$(printf '%s' "$gate" | cut -d'|' -f5-)
sudo docker exec gsa-tv-encoder-engine ffprobe -v error -show_entries format=duration:stream=index,codec_type,codec_name,sample_rate,channels,width,height,r_frame_rate -of compact=p=0:nk=0 "$media_path"
job_id=$(sudo docker run --rm --network host postgres:15-alpine psql "$database_url" -X -qAt -c "insert into public.gsa_tv_jobs(channel_id,job_type,status,progress,payload) values('ch-main','media_take','pending',0,jsonb_build_object('media_item_id','$media_id','source','explicit_user_audio_test','authorized_by','Adriano Farias')) returning id")
echo "job|$job_id"
job_row=''
for iteration in $(seq 1 50); do
  job_row=$(sudo docker run --rm --network host postgres:15-alpine psql "$database_url" -X -qAt -F '|' -c "select status,coalesce(error_message,''),coalesce(result::text,'') from public.gsa_tv_jobs where id='$job_id'")
  case "$job_row" in completed'|'*) break;; failed'|'*) echo "job_result|$job_row"; exit 1;; esac
  sleep 1
done
case "$job_row" in completed'|'*) ;; *) echo "job_timeout|$job_row"; exit 1;; esac
sleep 8
engine_json=$(engine_status)
outer_after=$(printf '%s' "$engine_json" | python3 -c 'import json,sys; print(json.load(sys.stdin)["outer_pid"])')
producer_after=$(printf '%s' "$engine_json" | python3 -c 'import json,sys; print(json.load(sys.stdin)["producer_pid"])')
channel=$(sudo docker run --rm --network host postgres:15-alpine psql "$database_url" -X -qAt -F '|' -c "select status,desired_state,playout_state,signal_state,coalesce(last_error,''),last_signal_at from public.gsa_tv_channels where id='ch-main'")
publisher_count=$(sudo docker top gsa-tv-encoder-engine -eo pid,args | grep -c '[a]\.rtmp\.youtube\.com/live2' || true)
echo "job_result|$job_row"
echo "channel|$channel"
echo "engine|outer_before=$outer_before|outer_after=$outer_after|producer_after=$producer_after"
echo "outer_preserved|$([ "$outer_before" = "$outer_after" ] && echo true || echo false)"
echo "rtmp_publishers|$publisher_count"
test "$outer_before" = "$outer_after"
test "$publisher_count" = 1
case "$channel" in online'|'running'|'media:'"$media_id"'|'sending'|'*) ;; *) echo 'unexpected_channel_state'; exit 1;; esac
sudo docker logs --since 2m gsa-tv-encoder-engine 2>&1 | grep -Ei 'error|corrupt|non-monoton|timestamp|audio|failed' | tail -n 30 || true
`,120000);
process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');
