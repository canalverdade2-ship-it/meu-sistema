import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`set -e
base=/home/opc/gsa-ai/work/identity-flow-20260907
pgrep -af '[d]ownload-flow-candidates.mjs' || true
tail -n 15 "$base/download-candidates.log" 2>/dev/null || true
find "$base/candidates" -maxdepth 1 -type f -name '*.mp4' 2>/dev/null | wc -l
du -sh "$base/candidates" 2>/dev/null || true
`,30000);process.stdout.write(r.stdout||'');
