import { runSshScript } from './ssh2-run.mjs';
const script=`set -euo pipefail
docker exec n8n sh -lc "find /usr/local/lib/node_modules/n8n -type f 2>/dev/null | grep -i 'execute.*workflow.*trigger' | head -20"
`;
const r=await runSshScript(script,60000);process.stdout.write(r.stdout);process.stderr.write(r.stderr);
