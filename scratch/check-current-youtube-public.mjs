import { runSshScript } from './ssh2-run.mjs';
const result=await runSshScript(`set -u
printf '%s\n' '--- PUBLIC METADATA ---'
for video_id in RqX4IJXdbGQ soeRG2L70ys g-Kbyx_zG-Y; do
  printf '%s: ' "$video_id"
  curl -fsSL --max-time 20 -A 'Mozilla/5.0' "https://www.youtube.com/watch?v=$video_id" | tr '\n' ' ' | grep -o '"isLiveNow":true\|"isLive":true\|"title":"[^"]*"' | head -n 3 | tr '\n' ' '; echo
done
printf '%s\n' '--- YT-DLP ---'
command -v yt-dlp || true
yt-dlp --no-warnings --skip-download --print '%(id)s|%(title)s|%(is_live)s|%(live_status)s|%(manifest_url)s' 'https://www.youtube.com/watch?v=RqX4IJXdbGQ' 2>&1 | tail -n 10 || true
`,90000);
process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');
