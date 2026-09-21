import { runSshScript } from './ssh2-run.mjs';
const script=`set -euo pipefail
f=$(docker exec n8n sh -lc "find /usr/local/lib/node_modules/n8n -path '*ExecuteWorkflowTrigger.node.js' | head -1")
docker exec n8n sh -lc "sed -n '1,180p' '$f' | grep -E 'version|defaultVersion|displayName|name' | head -30"
`;
const r=await runSshScript(script,60000);process.stdout.write(r.stdout);process.stderr.write(r.stderr);
