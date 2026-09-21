import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
sudo docker tag gsa-tv/control-plane:1.7.4-canonical-check gsa-tv/control-plane:1.7.5
sudo sed -i 's|image: gsa-tv/control-plane:1.7.4|image: gsa-tv/control-plane:1.7.5|' /opt/gsa-tv/control-plane/compose.yml
BEFORE=$(ps -eo pid=,args= | grep '[f]fmpeg' | grep 'rtmp://a.rtmp.youtube.com/live2/' | awk 'NR==1{print $1}')
cd /opt/gsa-tv/control-plane
sudo docker compose up -d --no-build
for i in $(seq 1 30); do
  S=$(sudo docker inspect gsa-tv-control-plane --format '{{.State.Health.Status}}' 2>/dev/null || true)
  [ "$S" = healthy ] && break
  sleep 1
done
test "$(sudo docker inspect gsa-tv-control-plane --format '{{.State.Health.Status}}')" = healthy
AFTER=$(ps -eo pid=,args= | grep '[f]fmpeg' | grep 'rtmp://a.rtmp.youtube.com/live2/' | awk 'NR==1{print $1}')
test "$BEFORE" = "$AFTER"
COUNT=$(ps -eo args= | grep '[f]fmpeg' | grep -c 'rtmp://a.rtmp.youtube.com/live2/' || true)
test "$COUNT" -eq 1
sudo docker exec gsa-tv-control-plane sh -lc '! find /app -type f | grep -q encoder-client && ! grep -Rqs "spawn(\\\"/app/bin/encoder-client.js\\\"" /app'
echo "control_image=$(sudo docker inspect gsa-tv-control-plane --format '{{.Config.Image}}')"
echo "outer_pid_preserved=$AFTER"
echo "publishers=$COUNT"
echo CLEAN_PROMOTION_PASS
`,180000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
