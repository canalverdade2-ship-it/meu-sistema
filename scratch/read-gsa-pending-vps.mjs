import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
echo '=== CHANGELOG ==='
tail -n 260 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
echo '=== PENDING FILES ==='
find /home/opc/gsa-ai -maxdepth 4 -type f \\( -iname '*pending*' -o -iname '*pendente*' -o -iname '*todo*' -o -iname '*status*' \\) -printf '%p\\n' 2>/dev/null | head -n 120
`,180000);
process.stdout.write(r.stdout);
if(r.stderr)process.stderr.write(r.stderr);
