import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
echo '=== TEST 1: GUARD REJECTS UNAUTHORIZED FAKE PUBLISHER ==='
sudo bash -c 'exec -a "ffmpeg -f lavfi -i testsrc rtmp://a.rtmp.youtube.com/live2/FAKE-NO-CONNECTION" sleep 60' &
FAKE=$!
sleep 7
if kill -0 "$FAKE" 2>/dev/null; then echo GUARD_FAIL; kill -9 "$FAKE" || true; exit 1; else echo GUARD_PASS; fi

echo '=== TEST 2: THREE CONTROL PLANE RESTARTS PRESERVE OUTER ==='
BEFORE=$(pgrep -f 'ffmpeg .*udp://127.0.0.1:12345.*rtmp' | head -n1)
for i in 1 2 3; do sudo docker restart gsa-tv-control-plane >/dev/null; sleep 6; NOW=$(pgrep -f 'ffmpeg .*udp://127.0.0.1:12345.*rtmp' | head -n1); COUNT=$( { pgrep -af 'rtmp://a.rtmp.youtube.com/live2/' || true; } | wc -l ); LEGACY=$( { pgrep -af 'encoder-client.js' || true; } | wc -l ); echo "round=$i outer=$NOW count=$COUNT legacy=$LEGACY"; test "$NOW" = "$BEFORE"; test "$COUNT" -eq 1; test "$LEGACY" -eq 0; done

echo '=== TEST 3: BACKUPS CANNOT AUTO-RESTART ==='
for c in gsa-tv-control-plane-backup-1.7.2 gsa-tv-control-plane-backup-1.7.3; do sudo docker inspect "$c" --format '{{.Name}} restart={{.HostConfig.RestartPolicy.Name}} state={{.State.Status}}'; test "$(sudo docker inspect "$c" --format '{{.HostConfig.RestartPolicy.Name}}')" = no; test "$(sudo docker inspect "$c" --format '{{.State.Status}}')" != running; done

echo '=== TEST 4: ADVISORY LOCK HELD ==='
DBURL=$(sudo docker inspect gsa-tv-encoder-engine --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
LOCKED=$(echo "select pg_try_advisory_lock(hashtext('gsa-tv-encoder:ch-main'));" | sudo docker run --rm -i --network host postgres:15-alpine psql -At "$DBURL")
echo competing_lock_acquired=$LOCKED
test "$LOCKED" = f

echo '=== TEST 5: SERVICE HEALTH ==='
curl -fsS http://127.0.0.1:9210/health
echo
sudo docker inspect gsa-tv-control-plane --format 'control={{.State.Health.Status}} image={{.Config.Image}}'
systemctl is-active gsa-rtmp-single-owner-guard.timer
journalctl -u gsa-rtmp-single-owner-guard.service --since '-3 minutes' --no-pager | tail -n 30

echo '=== STATIC RTMP-CAPABLE FILE INVENTORY ==='
sudo find /opt/gsa-tv /home/opc/gsa-ai -type f \\( -name '*.sh' -o -name '*.js' -o -name '*.mjs' -o -name '*.py' \\) -not -path '*/node_modules/*' -not -path '/opt/gsa-tv/cache/media/*' -print0 2>/dev/null | sudo xargs -0 grep -IlE 'a\\.rtmp\\.youtube|encoder-client\\.js' 2>/dev/null | head -n 300 || true
`,300000);
process.stdout.write(r.stdout); if(r.stderr)process.stderr.write(r.stderr);
