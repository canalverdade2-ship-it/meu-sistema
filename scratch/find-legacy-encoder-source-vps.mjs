import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
echo '=== CODE REFERENCES ==='
sudo docker exec gsa-tv-control-plane sh -lc "grep -RniE 'encoder-client|spawn.*ffmpeg|rtmp|AUTO.*START|restore' /app/src /app/bin 2>/dev/null | head -n 240"
echo '=== RECENT FINAL LOGS ==='
sudo docker logs --tail 40 gsa-tv-control-plane 2>&1 || true
`,180000);
process.stdout.write(r.stdout); if(r.stderr)process.stderr.write(r.stderr);
