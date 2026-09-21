import { runSshScript } from './ssh2-run.mjs';
const result=await runSshScript(`set -e
base=/home/opc/gsa-ai/work/identity-flow-20260907
cd "$base"
if pgrep -f '[f]low-export-census.cjs' >/dev/null; then echo ALREADY_RUNNING; else
 nohup node "$base/flow-export-census.cjs" ac1da714-fe03-4812-b62d-fb92d575e554 "$base/census.json" "$base/export-ac1da.json" >> "$base/export-census-runner.log" 2>&1 < /dev/null & echo "PID=$!"
fi
`,30000);process.stdout.write(result.stdout||'');
