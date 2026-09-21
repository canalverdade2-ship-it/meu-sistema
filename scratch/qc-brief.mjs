import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`set -e
base=/home/opc/gsa-ai/work/identity-flow-20260907
pgrep -af '[q]c-flow-candidates.mjs' || true
tail -n 25 "$base/qc-rerun.log" 2>/dev/null || true
find "$base/qc" -maxdepth 1 -type f -name 'contact-*.jpg' | wc -l
`,30000);process.stdout.write(r.stdout||'');
