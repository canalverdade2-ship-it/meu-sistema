import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
BEFORE=$(ps -eo pid=,args= | grep '[f]fmpeg' | grep 'rtmp://a.rtmp.youtube.com/live2/' | awk 'NR==1{print $1}')
sudo docker stop gsa-tv-control-plane >/dev/null
sudo docker rename gsa-tv-control-plane gsa-tv-control-plane-retired-1.7.4
if ! (cd /opt/gsa-tv/control-plane && sudo docker compose up -d --no-build); then
  sudo docker rm -f gsa-tv-control-plane 2>/dev/null || true
  sudo docker rename gsa-tv-control-plane-retired-1.7.4 gsa-tv-control-plane
  sudo docker start gsa-tv-control-plane >/dev/null
  exit 1
fi
for i in $(seq 1 30); do
  [ "$(sudo docker inspect gsa-tv-control-plane --format '{{.State.Health.Status}}' 2>/dev/null || true)" = healthy ] && break
  sleep 1
done
test "$(sudo docker inspect gsa-tv-control-plane --format '{{.State.Health.Status}}')" = healthy
AFTER=$(ps -eo pid=,args= | grep '[f]fmpeg' | grep 'rtmp://a.rtmp.youtube.com/live2/' | awk 'NR==1{print $1}')
test "$BEFORE" = "$AFTER"
test "$(ps -eo args= | grep '[f]fmpeg' | grep -c 'rtmp://a.rtmp.youtube.com/live2/' || true)" -eq 1
sudo docker exec gsa-tv-control-plane sh -lc '! find /app -type f | grep -q encoder-client'
sudo docker rm gsa-tv-control-plane-retired-1.7.4 >/dev/null
sudo docker image rm gsa-tv/control-plane:1.7.4 >/dev/null 2>&1 || true
echo "control_image=$(sudo docker inspect gsa-tv-control-plane --format '{{.Config.Image}}')"
echo "outer_pid_preserved=$AFTER"
echo CLEAN_PROMOTION_PASS
`,180000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
