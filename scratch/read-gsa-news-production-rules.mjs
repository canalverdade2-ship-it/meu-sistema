import { runSshScript } from './ssh2-run.mjs';
const script=String.raw`set -euo pipefail
echo MASTER_META
wc -l -c /home/opc/gsa-ai/GSA_TV_MEMORY_MASTER.md
cat /home/opc/gsa-ai/GSA_TV_MEMORY_MASTER.md
echo RUNBOOK_META
wc -l -c /home/opc/gsa-ai/docs/GSA_NEWS_DAILY_RUNBOOK.md
cat /home/opc/gsa-ai/docs/GSA_NEWS_DAILY_RUNBOOK.md
echo ACTIVE_MANIFESTS
find /opt/gsa-tv/cache/media/1/news -path '*/work/manifest.json' -type f -printf '%T@|%p\n' 2>/dev/null | sort -nr | head -10
`;
const r=await runSshScript(script,120000); process.stdout.write(r.stdout); process.stderr.write(r.stderr);
