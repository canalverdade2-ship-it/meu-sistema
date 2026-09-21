import { runSshScript } from './ssh2-run.mjs';
const result=await runSshScript(`set -eu
ffmpeg -hide_banner -loglevel error -y -ss 542 -t 23 -i /opt/gsa-tv/cache/media/1/news/gsa-news-2026-09-01-broadcast-v4/video/gsa-news-2026-09-01-broadcast-v4-final.mp4 -map 0:a:0 -c:a pcm_s24le -ar 48000 -ac 2 /tmp/source-offset-542-23s.wav
chown opc:opc /tmp/source-offset-542-23s.wav
ls -lh /tmp/source-offset-542-23s.wav`,30000);process.stdout.write(result.stdout||'');
