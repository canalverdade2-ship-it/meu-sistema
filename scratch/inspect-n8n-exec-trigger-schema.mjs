import { runSshScript } from './ssh2-run.mjs';
const script=`set -euo pipefail
f=$(docker exec n8n sh -lc "find /usr/local/lib/node_modules/n8n -path '*executeWorkflowTrigger/v12.schema.js' | head -1")
docker exec n8n sh -lc "sed -n '1,220p' '$f'"
`;
const r=await runSshScript(script,60000);process.stdout.write(r.stdout);process.stderr.write(r.stderr);
