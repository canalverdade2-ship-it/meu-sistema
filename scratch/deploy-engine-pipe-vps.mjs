import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
sudo sed -i 's|image: gsa-tv/encoder-engine:1.0.0|image: gsa-tv/encoder-engine:1.1.0|' /opt/gsa-tv/encoder-engine/compose.yml
cd /opt/gsa-tv/encoder-engine
sudo docker compose up -d --no-build
for i in $(seq 1 45); do
  H=$(sudo docker inspect gsa-tv-encoder-engine --format '{{.State.Health.Status}}' 2>/dev/null || true)
  [ "$H" = healthy ] && break
  sleep 1
done
test "$(sudo docker inspect gsa-tv-encoder-engine --format '{{.State.Health.Status}}')" = healthy
sleep 8
HEALTH=$(curl -fsS http://127.0.0.1:9210/health)
echo "$HEALTH" | grep -q '"outer_running":true'
echo "$HEALTH" | grep -q '"producer_running":true'
echo "$HEALTH" | grep -q '"last_error":null'
COUNT=$(ps -eo args= | grep '[f]fmpeg' | grep -c 'rtmp://a.rtmp.youtube.com/live2/' || true)
test "$COUNT" -eq 1
sudo docker exec gsa-tv-encoder-engine sh -lc 'for f in /proc/[0-9]*/cmdline; do tr "\\0" " " <"$f" 2>/dev/null; echo; done' >/tmp/gsa-engine-cmds.txt
grep -q -- '-i pipe:0' /tmp/gsa-engine-cmds.txt
grep -q 'pipe:1' /tmp/gsa-engine-cmds.txt
! grep -q 'udp://127.0.0.1:12345' /tmp/gsa-engine-cmds.txt
rm -f /tmp/gsa-engine-cmds.txt
! sudo ss -u -a -n -p | grep -q ':12345'
echo "image=$(sudo docker inspect gsa-tv-encoder-engine --format '{{.Config.Image}}')"
echo "publishers=$COUNT"
echo "internal_transport=pipe"
echo ENGINE_PIPE_LIVE
`,240000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
