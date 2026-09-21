import { runSshScript } from './ssh2-run.mjs';
const result=await runSshScript(`timeout 45s ffmpeg -hide_banner -nostats -i /opt/gsa-tv/cache/media/1/news/gsa-news-2026-09-01-broadcast-v4/video/gsa-news-2026-09-01-broadcast-v4-final.mp4 -map 0:a:0 -af astats=reset=0 -f null - 2>&1 | grep -E 'Max difference|Peak level dB|RMS level dB|Number of NaNs|Number of Infs' | tail -n 24`,55000);
process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');
