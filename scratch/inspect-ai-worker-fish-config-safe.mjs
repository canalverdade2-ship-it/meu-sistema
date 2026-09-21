import {runSshScript} from './ssh2-run.mjs';
const sh=String.raw`set -euo pipefail
f=/opt/gsa-tv/ai-worker/ai_worker.mjs
grep -n -B4 -A8 -E 'FISH|fish\.audio|sk-fish-' "$f" | sed -E 's/sk-fish-[A-Za-z0-9_-]+/[REDACTED]/g'
echo '=== SERVICE ==='
systemctl cat gsa-ai-producer.service | sed -E 's/(FISH[^=]*=).*/\1[REDACTED]/g'
`;
const r=await runSshScript(sh,60000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
