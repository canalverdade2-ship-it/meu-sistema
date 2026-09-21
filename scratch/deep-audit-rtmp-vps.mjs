import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
echo '=== ACTIVE RTMP ==='
pgrep -af 'rtmps?://' | sed -E 's#(live2/)[^ ]+#\\1REDACTED#g' || true
echo '=== ALL CONTAINERS ==='
sudo docker ps -a --format '{{.Names}}}}|{{.Image}}|{{.Status}}|{{.Ports}}' || true
echo '=== RESTART POLICIES ==='
for c in $(sudo docker ps -aq); do sudo docker inspect "$c" --format '{{.Name}}|{{.HostConfig.RestartPolicy.Name}}|{{.Config.Image}}'; done
echo '=== WATCHDOG CODE ==='
sudo docker inspect gsa-tv-watchdog --format '{{.Config.Image}} {{json .Config.Cmd}} {{json .Config.Entrpointry}} {{json .Mounts}}' || true
sudo docker exec gsa-tv-watchdog sh -lc "find /app -maxdepth 3 -type f -print 2>/dev/null; grep -RniE 'rtmp|encoder|control-plane|docker|restart|stream' /app 2>/dev/null | head -n 400" || true
echo '=== HOST SERVICES AND TIMERS ==='
systemctl list-unit-files --type=service --type=timer --no-pager | grep -Ei 'gsa|rtmp|encoder|stream|ffmpeg|watchdog' || true
systemctl list-timers --all --no-pager | grep -Ei 'gsa|rtmp|encoder|stream|ffmpeg|watchdog' || true
echo '=== CRON ==='
sudo grep -RniE 'rtmp|encoder-client|ffmpeg|gsa-tv-control-plane|gsa-tv-encoder' /etc/cron* /var/spool/cron 2>/dev/null || true
echo '=== HOST SCRIPTS/CODE RTMP REFERENCES ==='
sudo grep -RIlE 'a\\.rtmp\\.youtube|encoder-client\\.js|stream_key_ciphertext|/v1/ensure' /opt/gsa-tv /home/opc/gsa-ai /etc/systemd 2>/dev/null | head -n 500
echo '=== DB LOCKS ==='
DBURL=$(sudo docker inspect gsa-tv-encoder-engine --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
echo "select pid,application_name,client_addr,state,query from pg_stat_activity where query ilike '%advisory%' or application_name ilike '%encoder%';" | sudo docker run --rm -i --network host postgres:15-alpine psql "$DBURL" || true
echo '=== NETWORK CONNECTIONS ==='
sudo ss -ntp | grep -E ':1935|youtube|google' || true
`,180000);
process.stdout.write(r.stdout); if(r.stderr)process.stderr.write(r.stderr);
