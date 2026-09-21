import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
echo '=== containers ==='
sudo docker ps -a --format '{{.Names}}|{{.Status}}|{{.Image}}' | grep -Ei 'browser|vnc|novnc' || true
echo '=== ports ==='
sudo ss -lntp | grep -E ':(5900|6080|6088|9222) ' || true
echo '=== browser logs ==='
sudo docker logs --tail 120 gsa-ai-browser 2>&1 || true
echo '=== internal processes and listeners ==='
sudo docker exec gsa-ai-browser sh -lc "ps aux | grep -E 'Xvfb|x11vnc|websockify|novnc|chrom' | grep -v grep; ss -lntp 2>/dev/null | grep -E ':(5900|6080|9222) ' || true"
echo '=== internal TCP probes ==='
sudo docker exec gsa-ai-browser bash -lc 'for p in 5900 6080 9222; do timeout 2 bash -c "</dev/tcp/127.0.0.1/$p" >/dev/null 2>&1 && echo "$p open" || echo "$p closed"; done'
`,120000);
process.stdout.write(r.stdout);
