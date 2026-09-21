import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
echo '=== CONTAINERS ==='
sudo docker ps -a --format '{{.Names}}|{{.Image}}|{{.Status}}' | grep -E 'gsa-tv-control-plane|gsa-tv-encoder-engine'
echo '=== CONTROL LOG ==='
sudo docker logs --tail 60 gsa-tv-control-plane 2>&1
echo '=== ENGINE HEALTH ==='
curl -fsS http://127.0.0.1:9210/health
echo
echo '=== RTMP PUBLISHERS ==='
pgrep -af 'rtmp://a.rtmp.youtube.com/live2/' | sed -E 's#(live2/)[^ ]+#\\1REDACTED#g'
COUNT=$(pgrep -af 'rtmp://a.rtmp.youtube.com/live2/' | wc -l)
echo COUNT=$COUNT
test "$COUNT" -eq 1
echo '=== LEGACY CLIENTS ==='
pgrep -af 'encoder-client.js' || true
echo '=== OUTER PID ==='
pgrep -f 'ffmpeg .*udp://127.0.0.1:12345.*rtmp' | head -n1
`,180000);
process.stdout.write(r.stdout); if(r.stderr)process.stderr.write(r.stderr);
