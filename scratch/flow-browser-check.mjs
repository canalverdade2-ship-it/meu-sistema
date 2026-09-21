import { runSshScript } from './ssh2-run.mjs';
const result = await runSshScript(`set -e
echo '---CDP-9228---'
curl -sS --max-time 5 http://127.0.0.1:9228/json/version || true
echo
echo '---BROWSER-PROCESSES---'
pgrep -af 'chrome|chromium|Xvfb|novnc|desktop' | head -n 40 || true
echo '---LISTENERS---'
ss -lntp | grep -E ':922[0-9]|:590|:608' || true
`,30000);
process.stdout.write(result.stdout||'');
