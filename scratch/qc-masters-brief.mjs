import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`set -e
base=/home/opc/gsa-ai/work/identity-flow-20260907
pgrep -af '[q]c-gsa-masters.mjs' || true
tail -n 30 "$base/qc-masters-v1.log" 2>/dev/null || true
if test -f "$base/qc-masters-v1/master-qc-summary.json"; then cat "$base/qc-masters-v1/master-qc-summary.json"; fi
`,30000);process.stdout.write(r.stdout||'');
