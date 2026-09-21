import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
echo "=== B-ROLL ASSETS ON VPS ==="
find /opt/gsa-tv/cache/media/1/ -type f \\( -name "*.mp4" -o -name "*.webm" \\) | head -n 30

echo "=== GSA NEWS 02/09 V2 DIR ==="
ls -lh /opt/gsa-tv/cache/media/1/news/gsa-news-2026-09-02-v2/video/ 2>/dev/null || true
ls -lh /opt/gsa-tv/cache/media/1/news/gsa-news-2026-09-02-v2/assets/broll/ 2>/dev/null || true
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
