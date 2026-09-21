import { runSshScript } from './ssh2-run.mjs';
const result = await runSshScript(String.raw`
echo AI_EDITION
sudo find /home/opc/gsa-ai/editions/gsa-news-2026-09-01-30min -maxdepth 3 -type f -printf '%p|%s\n' 2>/dev/null | sort | head -n 300 || true
echo MEDIA_NEWS
sudo find /opt/gsa-tv/cache/media/1/news -maxdepth 4 -type f \( -iname '*.mp4' -o -iname '*.webm' -o -iname '*.mov' \) -printf '%p|%s\n' 2>/dev/null | sort | head -n 500 || true
`, 30000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
