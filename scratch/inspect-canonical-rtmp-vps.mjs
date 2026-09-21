import { runSshScript } from './ssh2-run.mjs';
const r = await runSshScript(`set -euo pipefail
echo '=== compose ==='
sudo sed -n '1,240p' /opt/gsa-tv/control-plane/compose.yml 2>/dev/null || true
echo '=== Dockerfile ==='
sudo sed -n '1,200p' /opt/gsa-tv/control-plane/Dockerfile 2>/dev/null || true
echo '=== stale references ==='
sudo grep -nE 'encoder-client|startStreamUnlocked|encoderEngineRequest|ENCODER_ENGINE' /opt/gsa-tv/control-plane/src/app.js | head -n 80 || true
echo '=== watchdog refs ==='
sudo docker exec gsa-tv-watchdog sh -lc "grep -nEi 'restart|control_plane|stream_start|/process|docker' /app/src/app.js || true" 2>/dev/null || true
echo '=== host launch refs ==='
sudo find /etc/systemd /etc/cron.d /opt/gsa-tv -type f -not -path '*/node_modules/*' -not -path '/opt/gsa-tv/cache/*' -print0 2>/dev/null | sudo xargs -0 grep -IlE 'encoder-client\\.js|a\\.rtmp\\.youtube' 2>/dev/null | head -n 200 || true
`,120000);
process.stdout.write(r.stdout); if(r.stderr) process.stderr.write(r.stderr);
