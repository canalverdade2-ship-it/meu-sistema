import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`set -e
base=/home/opc/gsa-ai/work/identity-flow-20260907
pgrep -af '[b]uild-gsa-masters.mjs' || true
tail -n 20 "$base/build-masters.log" 2>/dev/null || true
find "$base/masters-v1" -maxdepth 1 -type f -name '*.mp4' 2>/dev/null | wc -l
`,30000);process.stdout.write(r.stdout||'');
