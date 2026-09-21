import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
echo '=== SERVICES ==='
sudo docker ps --format '{{.Names}}|{{.Status}}' | grep -E 'gsa|ffmpeg|playout|control' || true
echo '=== ENCODERS/RTMP ==='
pgrep -af 'ffmpeg|rtmp' || true
echo '=== STATUS DOCS ==='
for f in /home/opc/gsa-ai/GSA_NEWS_2026-09-01_STATUS.md /home/opc/gsa-ai/GSA_NEWS_2026-09-01_EXTENDED_STATUS.md; do echo "--- $f"; test -f "$f" && tail -n 100 "$f"; done
echo '=== NEWS FILES ==='
find /home/opc/gsa-ai /opt/gsa-tv -maxdepth 5 -type f 2>/dev/null | grep -Ei 'gsa.news|news.*noite|noite.*news|schedule|playlist' | tail -n 180
echo '=== CONTROL API ==='
curl -fsS http://127.0.0.1:3010/health 2>/dev/null || true
echo
`,180000);
process.stdout.write(r.stdout); if(r.stderr)process.stderr.write(r.stderr);
