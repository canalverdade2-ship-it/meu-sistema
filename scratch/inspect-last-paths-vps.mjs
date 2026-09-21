import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
echo '=== control local spawn context ==='
sudo sed -n '820,880p' /opt/gsa-tv/control-plane/src/app.js
echo '=== producer/service units ==='
for u in gsa-ai-producer.service gsa-tv-n8n-bridge.service gsa-tv-backup.service gsa-backup.service; do echo "---$u"; systemctl cat "$u" 2>/dev/null || true; done
echo '=== enabled scripts RTMP refs ==='
for u in gsa-ai-producer.service gsa-tv-n8n-bridge.service; do
  systemctl show "$u" -p ExecStart --value
done
echo '=== engine source relevant ==='
sudo docker exec gsa-tv-encoder-engine sh -lc "grep -RniE 'advisory|spawn\\(|/v1/ensure|outer' /app/src /app 2>/dev/null | grep -v node_modules | head -n 200"
`,120000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
