import { runSshScript } from './ssh2-run.mjs';

const result = await runSshScript(`set -u
echo '=== CONTROL PLANE ORIGINS ==='
sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | grep '^ALLOWED_ORIGINS=' || true
sudo grep -nE '^ALLOWED_ORIGINS=' /opt/gsa-tv/control-plane/.env || true
echo '=== CORS IMPLEMENTATION ==='
sudo grep -nEi 'allowed_origins|access-control-allow-origin|origin' /opt/gsa-tv/control-plane/src/app.js | head -n 100
echo '=== PREFLIGHT LOCAL ORIGIN ==='
curl -ski -X OPTIONS 'https://api.147-15-43-141.nip.io/gsa-tv/live-console/snapshot' -H 'Origin: http://10.0.2.189:3000' -H 'Access-Control-Request-Method: GET' -H 'Access-Control-Request-Headers: x-gsa-session-id,x-gsa-session-token' | head -n 40
echo '=== PREFLIGHT PRODUCTION ORIGIN ==='
curl -ski -X OPTIONS 'https://api.147-15-43-141.nip.io/gsa-tv/live-console/snapshot' -H 'Origin: https://gsahub.com.br' -H 'Access-Control-Request-Method: GET' -H 'Access-Control-Request-Headers: x-gsa-session-id,x-gsa-session-token' | head -n 40
`, 30000);
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
