import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
echo '=== promote control plane ==='
cd /opt/gsa-tv/control-plane
sudo docker compose -f compose.yml config -q
sudo docker compose -f compose.yml up -d --no-build
for i in $(seq 1 90); do
  h=$(sudo docker inspect gsa-tv-control-plane --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' 2>/dev/null || true)
  code=$(curl -sS -o /tmp/cp-health-180 -w '%{http_code}' http://127.0.0.1:9202/health || true)
  [ "$h" = healthy ] && [ "$code" = 200 ] && break
  sleep 1
done
echo "cp_health=$h http=$code body=$(cat /tmp/cp-health-180 2>/dev/null || true)"
sudo docker inspect gsa-tv-control-plane --format '{{.Config.Image}}|{{.State.Health.Status}}|{{.State.StartedAt}}|restarts={{.RestartCount}}'
sudo docker logs --since 3m gsa-tv-control-plane 2>&1 | tail -n 100 | sed -E 's#(rtmps?://)[^ ]+#\\1[REDACTED]#g'
[ "$h" = healthy ] && [ "$code" = 200 ]

echo '=== engine after control plane restore ==='
curl -fsS http://127.0.0.1:9210/health; echo

echo '=== promote watchdog ==='
cd /opt/gsa-tv/watchdog
sudo docker compose -f compose.yml config -q
sudo docker compose -f compose.yml up -d --no-build
for i in $(seq 1 90); do
  wh=$(sudo docker inspect gsa-tv-watchdog --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' 2>/dev/null || true)
  wcode=$(curl -sS -o /tmp/wd-health-130 -w '%{http_code}' http://127.0.0.1:9204/health || true)
  [ "$wh" = healthy ] && [ "$wcode" = 200 ] && break
  sleep 1
done
echo "watchdog_health=$wh http=$wcode body=$(cat /tmp/wd-health-130 2>/dev/null || true)"
sudo docker inspect gsa-tv-watchdog --format '{{.Config.Image}}|{{.State.Health.Status}}|{{.State.StartedAt}}|restarts={{.RestartCount}}'
sudo docker logs --since 3m gsa-tv-watchdog 2>&1 | tail -n 100 | sed -E 's#(rtmps?://)[^ ]+#\\1[REDACTED]#g'
[ "$wh" = healthy ] && [ "$wcode" = 200 ]
`,240000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
