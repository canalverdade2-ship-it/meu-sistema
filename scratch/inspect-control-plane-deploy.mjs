import { runSshScript } from './ssh2-run.mjs';

const result = await runSshScript(`set -u
echo '=== SOURCE CONTEXT ==='
sudo sed -n '730,810p' /opt/gsa-tv/control-plane/src/app.js
echo '=== COMPOSE SERVICE ==='
cd /opt/gsa-tv
sudo docker compose config 2>/dev/null | sed -n '/control-plane:/,/^[^ ]/p' | head -n 100 || true
echo '=== CONTAINERS ==='
sudo docker inspect gsa-tv-control-plane --format '{{.Config.Image}}|{{json .Mounts}}' 2>/dev/null || true
echo '=== PACKAGE VERSION ==='
sudo grep -n 'version' /opt/gsa-tv/control-plane/package.json | head -n 3 || true
`, 30000);

process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
