import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
echo '=== render project ==='
find /home/opc/gsa-ai/work/chamada-grade-20260906/render-work -maxdepth 3 -type f -printf '%p %s bytes\n' 2>/dev/null | sort | head -n 240
echo '=== v2 ==='
find /home/opc/gsa-ai/work/chamada-grade-v2 -maxdepth 3 -type f -printf '%p %s bytes\n' 2>/dev/null | sort
echo '=== avatars ==='
find /home/opc/gsa-ai -type f -printf '%p %s bytes\n' 2>/dev/null | grep -Ei '/avatars/|avatar' | head -n 200
echo '=== logos and brand ==='
find /home/opc/gsa-ai/assets/brand -maxdepth 2 -type f -printf '%p %s bytes\n' 2>/dev/null | sort | head -n 160
echo '=== licensed/video source candidates ==='
find /home/opc/gsa-ai/work/chamada-grade-20260906 -type f -printf '%p %s bytes\n' 2>/dev/null | grep -Ei '\.(mp4|mov|webm) ' | sort | head -n 200
echo '=== project manifests ==='
find /home/opc/gsa-ai/work/chamada-grade-20260906/render-work -maxdepth 2 -type f -print 2>/dev/null | grep -Ei '(package\.json|\.(tsx|ts|js|json))$'
`,180000);
process.stdout.write(r.stdout);
