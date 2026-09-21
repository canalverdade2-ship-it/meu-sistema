import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -u
echo '=== Docker startup ordering and dependencies ==='
for c in gsa-tv-control-plane gsa-tv-encoder-engine gsa-tv-watchdog gsa-tv-ffplayout; do
  sudo docker inspect "$c" --format '{{.Name}} image={{.Config.Image}} restart={{.HostConfig.RestartPolicy.Name}} started={{.State.StartedAt}} network={{.HostConfig.NetworkMode}} depends={{json .HostConfig.Links}}'
done
echo '=== container events/restarts/OOM ==='
for c in gsa-tv-control-plane gsa-tv-encoder-engine gsa-tv-watchdog gsa-tv-ffplayout; do
 sudo docker inspect "$c" --format '{{.Name}} restart_count={{.RestartCount}} oom={{.State.OOMKilled}} exit={{.State.ExitCode}} error={{.State.Error}} health={{if .State.Health}}{{.State.Health.Status}}{{end}}'
done
echo '=== engine state persistence ==='
sudo stat -c '%U:%G %a %s %y %n' /opt/gsa-tv/runtime/encoder-state.json
sudo python3 - <<'PY'
import json
d=json.load(open('/opt/gsa-tv/runtime/encoder-state.json'))
print({k:d.get(k) for k in ('version','desired','mode')})
print('args_count',len(d.get('args',[])),'has_pipe',any('pipe:' in str(x) for x in d.get('args',[])),'has_udp',any('udp://' in str(x) for x in d.get('args',[])))
PY
echo '=== state divergence ==='
DBURL=$(sudo docker inspect gsa-tv-encoder-engine --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
echo "select desired_state,playout_state,signal_state,status,last_error,last_heartbeat_at,last_signal_at from public.gsa_tv_channels where id='ch-main';" | sudo docker run --rm -i --network host postgres:15-alpine psql -At "$DBURL"
curl -fsS http://127.0.0.1:9202/status -H "Authorization: Bearer $(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="INTERNAL_API_TOKEN"{sub(/^INTERNAL_API_TOKEN=/,"");print;exit}')" 2>/dev/null | head -c 3000; echo
curl -fsS http://127.0.0.1:9210/health; echo
echo '=== network listeners exposure ==='
sudo ss -lntup | grep -E ':(9202|9210|5577|8787|3000|1935|12345)\\b' || true
echo '=== runtime permissions ==='
sudo find /opt/gsa-tv/runtime -maxdepth 2 -type f -printf '%m %u:%g %s %p\\n' | sort | head -n 200
echo '=== HLS final freshness and structure ==='
sudo stat -c '%Y %y %s %n' /opt/gsa-tv/runtime/hls/program.m3u8 /opt/gsa-tv/runtime/hls/program_*.ts 2>/dev/null | tail -n 15
sudo sed -n '1,80p' /opt/gsa-tv/runtime/hls/program.m3u8
echo '=== DB unresolved incidents ==='
echo "select severity,message,created_at,details from public.gsa_tv_incidents where channel_id='ch-main' and not resolved order by created_at desc limit 50;" | sudo docker run --rm -i --network host postgres:15-alpine psql -At "$DBURL"
echo '=== job latency and duplicate commands ==='
echo "select job_type,status,count(*),round(avg(extract(epoch from(coalesce(finished_at,now())-created_at)))::numeric,2) avg_s,max(coalesce(finished_at,now())-created_at) from public.gsa_tv_jobs where created_at>now()-interval '7 days' group by job_type,status order by max(coalesce(finished_at,now())-created_at) desc;" | sudo docker run --rm -i --network host postgres:15-alpine psql -At "$DBURL" | head -n 100
echo '=== engine/CP clock ==='
date -Ins
sudo docker exec gsa-tv-control-plane date -Ins
sudo docker exec gsa-tv-encoder-engine date -Ins
`,240000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
