import { runSshScript } from './ssh2-run.mjs';

const result = await runSshScript(`set -u
database_url=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
engine_token=$(sudo awk -F= '$1=="ENCODER_ENGINE_TOKEN"{print substr($0,index($0,"=")+1);exit}' /opt/gsa-tv/control-plane/.env)
echo '=== ENGINE ==='
curl -fsS -H "Authorization: Bearer $engine_token" http://127.0.0.1:9210/v1/status | python3 -c 'import json,sys; d=json.load(sys.stdin); print(json.dumps({k:d.get(k) for k in ("outer_pid","producer_pid","outer_alive","producer_alive","state","actual","last_error")},ensure_ascii=False))' || true
echo '=== CHANNEL DB ==='
sudo docker run --rm --network host postgres:15-alpine psql "$database_url" -X -qAt -F '|' -c "select status,desired_state,playout_state,signal_state,coalesce(config->>'youtube_video_id',''),coalesce(last_error,''),last_signal_at,updated_at from public.gsa_tv_channels where id='ch-main'"
echo '=== RTMP PROCESSES ==='
sudo docker top gsa-tv-encoder-engine -eo pid,ppid,etimes,%cpu,args | grep -E '[f]fmpeg' | sed -E 's#rtmps?://[^ ]+#rtmp://[PROTECTED]#g'
echo '=== RTMP SOCKET ==='
outer_host_pid=$(sudo docker top gsa-tv-encoder-engine -eo pid,args | grep 'pipe:0' | grep 'rtmp://' | awk '{print $1}' | head -n 1)
if [ -n "$outer_host_pid" ]; then sudo nsenter -t 1 -n ss -tinp | grep -A2 -B1 "pid=$outer_host_pid" || true; fi
echo '=== PANEL PUBLIC CHECK CODE ==='
sudo grep -nEi 'youtube_video_id|PUBLIC_LIVE|offline|live=true|youtube.*confirm|Relay enviando' /opt/gsa-tv/control-plane/src/app.js | tail -n 100 || true
echo '=== RECENT LOGS ==='
sudo docker logs --since 15m gsa-tv-control-plane 2>&1 | tail -n 100
`, 30000);

process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
