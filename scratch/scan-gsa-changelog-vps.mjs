import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
echo '=== STATUS MARKERS ==='
grep -nEi 'pendente|pendência|aguarda|ainda não|não foi|próximo passo|falta|bloqueio|TODO|candidata|não inserido|não colocado' /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md | tail -n 220
echo '=== TOP HEADINGS ==='
grep -nE '^#{1,4} ' /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md | tail -n 100
`,180000);
process.stdout.write(r.stdout); if(r.stderr)process.stderr.write(r.stderr);
