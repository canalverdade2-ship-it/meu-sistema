import { runSshScript } from './ssh2-run.mjs';

const result = await runSshScript(`set -e
media='/opt/gsa-tv/cache/media/1/news/gsa-news-2026-09-01-broadcast-v4/video/gsa-news-2026-09-01-broadcast-v4-final.mp4'
echo '=== SOURCE AUDIO ==='
sudo docker run --rm -v /opt:/opt gsa-tv/control-plane:1.8.3 ffprobe -v error -select_streams a:0 -show_entries stream=codec_name,profile,sample_fmt,sample_rate,channels,channel_layout,bit_rate,time_base,start_time,duration -of default=nw=1 "$media"
echo '=== FIRST PACKETS ==='
sudo docker run --rm -v /opt:/opt gsa-tv/control-plane:1.8.3 ffprobe -v error -select_streams a:0 -show_entries packet=pts_time,dts_time,duration_time,size,flags -of csv=p=0 -read_intervals '%+0.25' "$media" | head -n 15
echo '=== COPY REMUX PROOF ==='
sudo docker run --rm -v /opt:/opt gsa-tv/control-plane:1.8.3 ffmpeg -hide_banner -loglevel warning -t 30 -i "$media" -map 0:v:0 -map 0:a:0 -c:v copy -c:a copy -f mpegts -y /tmp/gsa-audio-copy-proof.ts 2>&1
sudo docker run --rm -v /tmp:/tmp gsa-tv/control-plane:1.8.3 ffmpeg -hide_banner -loglevel warning -i /tmp/gsa-audio-copy-proof.ts -map 0:v:0 -map 0:a:0 -c copy -f flv -y /tmp/gsa-audio-copy-proof.flv 2>&1
sudo docker run --rm -v /tmp:/tmp gsa-tv/control-plane:1.8.3 ffprobe -v error -select_streams a:0 -show_entries stream=codec_name,sample_rate,channels -show_entries format=duration -of default=nw=1 /tmp/gsa-audio-copy-proof.flv
rm -f /tmp/gsa-audio-copy-proof.ts /tmp/gsa-audio-copy-proof.flv
`, 60000);

process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
