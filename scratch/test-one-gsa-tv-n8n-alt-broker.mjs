import { runSshScript } from './ssh2-run.mjs';
const script=`set -euo pipefail
set +e
out=$(docker exec -e N8N_RUNNERS_BROKER_PORT=5689 n8n n8n execute --id=gsaTvMediaReadiness01 --rawOutput 2>&1)
rc=$?
set -e
printf '%s\n' "$out" | tail -c 4000
printf '\nexit=%s\n' "$rc"
exit "$rc"
`;
const r=await runSshScript(script,120000);process.stdout.write(r.stdout);process.stderr.write(r.stderr);
