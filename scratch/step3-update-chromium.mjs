import { runSshScript } from './ssh2-run.mjs';

const script = `
set -e
echo "=== STEP 3: CHROMIUM SANITIZATION AND START SCRIPT HARDENING ==="

cp /home/opc/gsa-ai/start.sh /home/opc/gsa-ai/start.sh.bak

cat << 'EOF' > /home/opc/gsa-ai/start.sh
#!/bin/bash
set -euo pipefail

mkdir -p /data/profile /data/downloads /tmp/.X11-unix
rm -f /tmp/.X99-lock /tmp/.X11-unix/X99
rm -f /data/profile/SingletonLock /data/profile/SingletonCookie /data/profile/SingletonSocket

Xvfb :99 -screen 0 1440x900x24 -nolisten tcp &
sleep 1
openbox >/tmp/openbox.log 2>&1 &
x11vnc -display :99 -forever -shared -nopw -localhost -rfbport 5900 >/tmp/x11vnc.log 2>&1 &
websockify --web=/usr/share/novnc 6080 localhost:5900 >/tmp/novnc.log 2>&1 &
socat TCP-LISTEN:9223,fork,reuseaddr TCP:127.0.0.1:9222 >/tmp/cdp-relay.log 2>&1 &

exec chromium \
  --no-sandbox \
  --user-data-dir=/data/profile \
  --no-first-run \
  --disable-dev-shm-usage \
  --disable-software-rasterizer \
  --renderer-process-limit=2 \
  --remote-debugging-port=9222 \
  --remote-allow-origins=http://127.0.0.1 \
  --window-size=1440,900 \
  --start-maximized \
  https://gemini.google.com/
EOF
chmod +x /home/opc/gsa-ai/start.sh

echo "Rebuilding gsa-ai-browser container image..."
cd /home/opc/gsa-ai
sudo docker compose build gsa-ai-browser
sudo docker compose up -d --force-recreate gsa-ai-browser

echo "Waiting for gsa-ai-browser to come online..."
sleep 5

echo "Applying oom_score_adj to new browser container..."
for pid in $(sudo docker top gsa-ai-browser -o pid 2>/dev/null | tail -n +2); do
  echo 500 | sudo tee /proc/$pid/oom_score_adj >/dev/null || true
done

echo "Checking browser cgroups:"
cid=$(sudo docker inspect --format '{{.Id}}' gsa-ai-browser)
cgpath=$(find /sys/fs/cgroup -name "*$cid*" | head -n 1)
echo "Path: $cgpath"
echo "  cpuset.cpus:           $(cat $cgpath/cpuset.cpus)"
echo "  cpuset.cpus.effective: $(cat $cgpath/cpuset.cpus.effective 2>/dev/null)"
echo "  cpu.weight:            $(cat $cgpath/cpu.weight)"
echo "  cpu.max:               $(cat $cgpath/cpu.max)"

echo "Checking CDP port 9228 response..."
for i in {1..10}; do
  if curl -s http://127.0.0.1:9228/json/version > /dev/null; then
    echo "CDP is UP and responsive!"
    curl -s http://127.0.0.1:9228/json/version | jq .
    break
  fi
  echo "Waiting for CDP..."
  sleep 2
done

echo "Checking running processes in gsa-ai-browser:"
sudo docker top gsa-ai-browser
`;

const res = await runSshScript(script);
console.log(res.stdout);
if (res.stderr) console.error("STDERR:", res.stderr);
