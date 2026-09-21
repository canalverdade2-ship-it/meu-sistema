import { runSshScript } from './ssh2-run.mjs';
const script = `set -euo pipefail
sudo /opt/gsa-tv/n8n-bridge/import-workflows.sh
echo '=== GSA TV workflows ==='
docker exec n8n n8n list:workflow 2>/dev/null | grep 'GSA TV' | sort
echo '=== total ==='
docker exec n8n n8n list:workflow 2>/dev/null | grep -v '^Acquiring' | grep -c '|'
`;
const r = await runSshScript(script, 240000);
process.stdout.write(r.stdout);
process.stderr.write(r.stderr);
