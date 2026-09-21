import { runSshScript } from './ssh2-run.mjs';
const result = await runSshScript(String.raw`
base=/home/opc/gsa-ai/editions/gsa-news-2026-09-01-30min/work
for f in advance_female_avatar.js make_latest_short_avatar.js make_scene23_short_avatar.js generate_scene25_avatar.js insert_first_stock_video.js; do
  echo "===== $f ====="
  sudo sed -n '1,260p' "$base/$f" 2>/dev/null || true
done
`, 30000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
