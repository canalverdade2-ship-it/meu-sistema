import { runSshScript } from './ssh2-run.mjs';
const result = await runSshScript(`set -euo pipefail
base=/home/opc/gsa-ai/work/identity-flow-20260907
if pgrep -f '[f]low-slow-complete.cjs' >/dev/null; then
  echo ALREADY_RUNNING
else
  cd "$base"
  nohup node "$base/flow-slow-complete.cjs" >> "$base/runner-stdout.log" 2>&1 < /dev/null &
  echo "STARTED_PID=$!"
fi
sleep 3
pgrep -af '[f]low-slow-complete.cjs' || true
tail -n 12 "$base/slow-run.log"
`,30000);
process.stdout.write(result.stdout||'');
