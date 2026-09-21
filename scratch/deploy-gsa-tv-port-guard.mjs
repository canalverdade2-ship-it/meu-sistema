import fs from 'node:fs';
import { runSshScript } from './ssh2-run.mjs';

const unit = fs.readFileSync(new URL('../infrastructure/gsa-tv/systemd/gsa-tv-public-port-guard.service', import.meta.url), 'utf8');
const encoded = Buffer.from(unit).toString('base64');
const remote = String.raw`set -euo pipefail
printf '%s' '${encoded}' | base64 -d | sudo tee /etc/systemd/system/gsa-tv-public-port-guard.service >/dev/null
sudo chmod 0644 /etc/systemd/system/gsa-tv-public-port-guard.service
sudo systemctl daemon-reload
sudo systemctl enable --now gsa-tv-public-port-guard.service
sudo systemctl is-active gsa-tv-public-port-guard.service
sudo iptables -S DOCKER-USER | grep -E -- '--dport (5432|5433|5678)'
curl -fsS http://127.0.0.1:5678/healthz
echo
sudo docker exec n8n node -e "fetch('http://172.30.250.1:19202/automation/snapshot').then(async r=>{console.log('bridge='+r.status);if(r.status!==200)process.exit(1)})"
`;

const result = await runSshScript(remote, 45000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
