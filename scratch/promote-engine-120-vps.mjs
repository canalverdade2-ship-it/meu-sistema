import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
echo 'before:'
sudo docker inspect gsa-tv-encoder-engine --format '{{.Config.Image}}|{{.State.Health.Status}}|{{.State.StartedAt}}'
curl -fsS http://127.0.0.1:9210/health; echo
cd /opt/gsa-tv/encoder-engine
sudo docker compose -f compose.yml config -q
sudo docker compose -f compose.yml up -d --no-build
for i in $(seq 1 90); do
  health=$(sudo docker inspect gsa-tv-encoder-engine --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' 2>/dev/null || true)
  code=$(curl -sS -o /tmp/engine-health-120 -w '%{http_code}' http://127.0.0.1:9210/health || true)
  if [ "$health" = healthy ] && [ "$code" = 200 ]; then break; fi
  sleep 1
done
echo "after_health=$health http=$code"
cat /tmp/engine-health-120; echo
sudo docker inspect gsa-tv-encoder-engine --format '{{.Config.Image}}|{{.State.Health.Status}}|{{.State.StartedAt}}|restarts={{.RestartCount}}'
sudo docker logs --since 3m gsa-tv-encoder-engine 2>&1 | tail -n 80 | sed -E 's#(rtmps?://)[^ ]+#\\1[REDACTED]#g'
[ "$health" = healthy ] && [ "$code" = 200 ]
`,180000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
