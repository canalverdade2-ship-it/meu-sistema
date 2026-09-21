import { runSshScript } from './ssh2-run.mjs';

const remote = String.raw`set -euo pipefail
sudo awk 'BEGIN{p=0} /^  n8n:/{p=1} p{print} p && /^  [A-Za-z0-9_-]+:/ && $1!="n8n:" && NR>1{exit}' /home/opc/gsa-hub/docker-compose.yml
`;

const result = await runSshScript(remote, 45000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
