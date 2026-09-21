import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`set -e
base=/home/opc/gsa-ai/work/identity-flow-20260907
if pgrep -f '[b]uild-gsa-masters.mjs' >/dev/null; then echo ALREADY_RUNNING; else
 nohup node "$base/build-gsa-masters.mjs" >> "$base/build-masters.log" 2>&1 < /dev/null & echo "PID=$!"
fi`,30000);process.stdout.write(r.stdout||'');
