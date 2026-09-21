import { runSshScript } from './ssh2-run.mjs';
const remote=String.raw`set -e
printf '%s\n' '=== n8n ports ==='
sudo docker port n8n || true
printf '%s\n' '=== compose sensitive keys ==='
if [ -f /home/opc/gsa-hub/docker-compose.yml ]; then
  grep -Ein 'password|secret|token|encryption|api[_-]?key|credential' /home/opc/gsa-hub/docker-compose.yml | sed -E 's/(=|:).*/\1 <redacted>/' || true
fi
printf '%s\n' '=== compose service names ==='
awk '/^  [A-Za-z0-9_.-]+:$/ {gsub(/:| /,""); print}' /home/opc/gsa-hub/docker-compose.yml 2>/dev/null || true
`;
const r=await runSshScript(remote,30000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
