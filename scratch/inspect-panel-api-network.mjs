import { runSshScript } from './ssh2-run.mjs';

const result = await runSshScript(`set -u
echo '=== YOUTUBE CACHE FUNCTION ==='
sudo sed -n '1380,1430p' /opt/gsa-tv/control-plane/src/app.js
echo '=== API ROUTES/PREVIEW ==='
sudo sed -n '1300,1380p' /opt/gsa-tv/control-plane/src/app.js
echo '=== NGINX GSA-TV ROUTE ==='
sudo grep -RniE 'gsa-tv|9202|preview' /etc/nginx 2>/dev/null | head -n 100 || true
echo '=== EXTERNAL API HEALTH ==='
curl -skI --max-time 15 https://api.147-15-43-141.nip.io/gsa-tv/health | head -n 20 || true
curl -skI --max-time 15 https://api.147-15-43-141.nip.io/gsa-tv/preview/program.m3u8 | head -n 20 || true
`, 60000);
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
