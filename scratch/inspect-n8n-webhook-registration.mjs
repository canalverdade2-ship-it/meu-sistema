import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
docker exec evo-postgres psql -U evo -d n8n -X -At -F '|' -c 'select w.name,h.method,h."webhookPath" from webhook_entity h join workflow_entity w on w.id=h."workflowId" order by w.name;'
`);
process.stdout.write(r.stdout);process.stderr.write(r.stderr);