import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
cleanup(){ sudo docker rm -f gsa-tv-engine-candidate-test gsa-tv-watchdog-candidate-test gsa-tv-cp-candidate-test >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup
TOKEN=$(sudo docker inspect gsa-tv-encoder-engine --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="ENCODER_ENGINE_TOKEN"{sub(/^ENCODER_ENGINE_TOKEN=/,"");print;exit}')
DBURL=$(sudo docker inspect gsa-tv-encoder-engine --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
echo '=== syntax/module smoke ==='
sudo docker run --rm --entrypoint node gsa-tv/encoder-engine:1.2.0 --check /app/src/app.js
sudo docker run --rm --entrypoint node gsa-tv/watchdog:1.3.0 --check /app/src/app.js
sudo docker run --rm --entrypoint node gsa-tv/control-plane:1.8.0 --check /app/src/app.js
echo '=== engine isolated stopped-state health/auth ==='
sudo docker run -d --name gsa-tv-engine-candidate-test --network host --read-only --tmpfs /tmp:size=32m --tmpfs /runtime:size=32m \
  -e ENCODER_ENGINE_PORT=19210 -e ENCODER_ENGINE_TOKEN="$TOKEN" -e DATABASE_URL="$DBURL" -e ENCODER_LOCK_DISABLED=true \
  gsa-tv/encoder-engine:1.2.0 >/dev/null
for i in $(seq 1 20); do code=$(curl -sS -o /tmp/engine-candidate-health -w '%{http_code}' http://127.0.0.1:19210/health || true); [ "$code" = 200 ] && break; sleep 1; done
echo "engine_health_code=$code body=$(cat /tmp/engine-candidate-health)"
bad=$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:19210/v1/status || true)
good=$(curl -sS -o /tmp/engine-candidate-status -w '%{http_code}' -H "Authorization: Bearer $TOKEN" http://127.0.0.1:19210/v1/status || true)
echo "engine_unauth=$bad engine_auth=$good"
sudo docker logs gsa-tv-engine-candidate-test 2>&1 | tail -n 30
echo '=== image package audit ==='
for image in gsa-tv/encoder-engine:1.2.0 gsa-tv/watchdog:1.3.0 gsa-tv/control-plane:1.8.0; do echo "$image"; sudo docker run --rm --entrypoint npm "$image" audit --omit=dev --audit-level=high 2>&1 | tail -n 20 || true; done
`,240000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
