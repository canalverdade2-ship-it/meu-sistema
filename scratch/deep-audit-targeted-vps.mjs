import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
echo '=== WATCHDOG SOURCE ==='
sudo docker exec gsa-tv-watchdog sh -lc "sed -n '1,320p' /app/src/app.js" || true
echo '=== SERVICES/TIMERS ==='
systemctl list-unit-files --type=service --type=timer --no-pager | grep -Ei 'gsa|rtmp|encoder|stream|ffmpeg|watchdog' || true
systemctl list-timers --all --no-pager | grep -Ei 'gsa|rtmp|encoder|stream|ffmpeg|watchdog' || true
echo '=== CRON ==='
sudo grep -RniE 'rtmp|encoder-client|ffmpeg|gsa-tv-control-plane|gsa-tv-encoder' /etc/cron.d /etc/crontab /var/spool/cron 2>/dev/null || true
echo '=== SELECTED HOST REFERENCES ==='
find /opt/gsa-tv /home/opc/gsa-ai -type f \\( -name '*.sh' -o -name '*.js' -o -name '*.mjs' -o -name '*.service' -o -name '*.timer' -o -name '*.yml' -o -name '*.yaml' \\) -not -path '*/node_modules/*' -not -path '*/cache/media/*' -print0 | xargs -0 grep -IlE 'a\\.rtmp\\.youtube|encoder-client\\.js|stream_key_ciphertext|/v1/ensure' 2>/dev/null | head -n 300
echo '=== BACKUP POLICY ==='
sudo docker inspect gsa-tv-control-plane-backup-1.7.2 --format '{{.HostConfig.RestartPolicy.Name}} {{.State.Status}}'
echo '=== ENGINE LOCK SESSION ==='
DBURL=$(sudo docker inspect gsa-tv-encoder-engine --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
echo "select pid,application_name,state,wait_event_type,wait_event from pg_stat_activity where application_name='gsa-tv-encoder-engine';" | sudo docker run --rm -i --network host postgres:15-alpine psql "$DBURL"
`,180000);
process.stdout.write(r.stdout); if(r.stderr)process.stderr.write(r.stderr);
