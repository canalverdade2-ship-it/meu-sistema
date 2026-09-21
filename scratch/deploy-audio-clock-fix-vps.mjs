import { runSshScript } from './ssh2-run.mjs';

const result = await runSshScript(`set -e
cd /opt/gsa-tv/control-plane
sudo docker build -t gsa-tv/control-plane:1.8.4 .
sudo docker run --rm --entrypoint node gsa-tv/control-plane:1.8.4 --check /app/src/app.js
sudo docker compose up -d --no-deps control-plane
for i in $(seq 1 30); do
  state=$(sudo docker inspect gsa-tv-control-plane --format '{{.State.Status}}' 2>/dev/null || true)
  [ "$state" = running ] && break
  sleep 1
done
echo "control_plane=$(sudo docker inspect gsa-tv-control-plane --format '{{.Config.Image}}|{{.State.Status}}')"
sudo docker exec gsa-tv-control-plane sed -n '770,782p' /app/src/app.js
echo "outer_before=$(sudo docker top gsa-tv-encoder-engine -eo pid,ppid,etimes,args | grep 'rtmp://' | grep -v grep | awk '{print $1}' | head -n 1)"
`, 180000);

process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
