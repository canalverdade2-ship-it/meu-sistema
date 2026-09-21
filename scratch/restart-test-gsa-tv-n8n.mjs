import { runSshScript } from './ssh2-run.mjs';
const script = `set -euo pipefail
docker restart n8n >/dev/null
for i in $(seq 1 30); do
  if docker exec n8n node -e "fetch('http://172.30.250.1:19202/health').then(r=>{if(!r.ok)process.exit(1);return r.json()}).then(x=>{if(x.status!=='ok')process.exit(1)})" >/dev/null 2>&1; then break; fi
  sleep 2
done
echo '=== bridge-health ==='
docker exec n8n node -e "fetch('http://172.30.250.1:19202/health').then(async r=>console.log(r.status,await r.text()))"
echo '=== snapshot-through-bridge ==='
docker exec n8n node -e "fetch('http://172.30.250.1:19202/automation/snapshot').then(async r=>{const x=await r.json();console.log(JSON.stringify({http:r.status,status:x.channel?.status,desired:x.channel?.desired_state,playout:x.channel?.playout_state,signal:x.channel?.signal_state,error:x.channel?.last_error,ai_ready:(x.ai_ready||[]).length}))})"
echo '=== services ==='
systemctl is-active gsa-tv-n8n-bridge.service
docker inspect -f '{{.State.Status}}|{{.State.Health.Status}}' n8n 2>/dev/null || docker inspect -f '{{.State.Status}}' n8n
`;
const r=await runSshScript(script,180000);process.stdout.write(r.stdout);process.stderr.write(r.stderr);
