import { runSshScript } from './ssh2-run.mjs';
const result=await runSshScript(`for video_id in soeRG2L70ys g-Kbyx_zG-Y kX7gdLa1dK0; do
 echo "--- $video_id ---"
 yt-dlp --no-warnings --skip-download --print '%(id)s|%(title)s|%(is_live)s|%(live_status)s|%(availability)s|%(manifest_url)s' "https://www.youtube.com/watch?v=$video_id" 2>&1 | tail -n 6 || true
done`,90000);
process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');
