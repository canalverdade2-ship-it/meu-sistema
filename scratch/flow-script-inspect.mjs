import { runSshScript } from './ssh2-run.mjs';
const result = await runSshScript(`set -e
f=/home/opc/gsa-ai/work/identity-flow-20260907/flow-slow-complete.cjs
echo '---SCRIPT-1-90---'
nl -ba "$f" | sed -n '1,90p'
echo '---OTHER-STATES---'
for x in /home/opc/gsa-ai/work/identity-flow-20260907/*state.json; do echo "### $x"; cat "$x"; echo; done
echo '---BROWSER---'
curl -sS --max-time 3 http://127.0.0.1:9222/json/version || true
`,30000);
process.stdout.write(result.stdout||'');
