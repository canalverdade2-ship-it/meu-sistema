import { runSshScript } from './ssh2-run.mjs';
const remote = String.raw`set -e
sudo docker exec n8n n8n --version
printf '%s\n' '=== workflows ==='
sudo docker exec n8n n8n list:workflow
printf '%s\n' '=== network-exists ==='
sudo docker network inspect gsa-tv-automation-net --format '{{json .IPAM.Config}}' 2>/dev/null || echo missing
`;
const result = await runSshScript(remote, 30000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
