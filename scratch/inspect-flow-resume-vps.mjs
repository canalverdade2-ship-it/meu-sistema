import { runSshScript } from './ssh2-run.mjs';
const r = await runSshScript(`set -e
base=/home/opc/gsa-ai/work/identity-flow-20260907
printf '%s\n' '--- STATE ---'
cat "$base/slow-state.json"
printf '%s\n' '--- LOG TAIL ---'
tail -n 100 "$base/slow-run.log"
printf '%s\n' '--- SCRIPT HEAD ---'
sed -n '1,260p' "$base/flow-slow-complete.cjs"
printf '%s\n' '--- PROCESSES ---'
pgrep -af 'flow-slow-complete|identity-flow' || true
`, 30000);
process.stdout.write(r.stdout || '');
