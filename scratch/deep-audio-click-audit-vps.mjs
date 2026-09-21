import { runSshScript } from './ssh2-run.mjs';
const r = await runSshScript(`set -euo pipefail
echo '=== output post-filter click count over 42s ==='
sudo docker exec gsa-tv-encoder-engine timeout 55 ffmpeg -hide_banner -nostdin -i /runtime/hls/program.m3u8 -map 0:a:0 -t 42 -af 'adeclick=w=55:o=75:a=2:t=2:b=2,astats=metadata=0:reset=0' -f null - 2>&1 | grep -E 'Detected clicks|Peak level dB|RMS level dB|Number of samples' | tail -n 20 || true
echo '=== original incoming click count ==='
sudo docker exec gsa-tv-encoder-engine ffmpeg -hide_banner -nostdin -i /media/1/incoming/media-836c5fe7-e994-455c-bfa4-76b5a803d94c.mp4 -map 0:a:0 -af 'adeclick=w=55:o=75:a=2:t=2:b=2' -f null - 2>&1 | grep 'Detected clicks' | tail -n 5 || true
echo '=== normalized source click count ==='
sudo docker exec gsa-tv-encoder-engine ffmpeg -hide_banner -nostdin -i /media/1/normalized/media-836c5fe7-e994-455c-bfa4-76b5a803d94c-720p30.mp4 -map 0:a:0 -af 'adeclick=w=55:o=75:a=2:t=2:b=2' -f null - 2>&1 | grep 'Detected clicks' | tail -n 5 || true
echo '=== packet timestamp continuity 42s ==='
sudo docker exec gsa-tv-encoder-engine timeout 55 ffprobe -v error -read_intervals '%+42' -select_streams a:0 -show_entries packet=pts_time,dts_time,duration_time,flags -of csv=p=0 /runtime/hls/program.m3u8 2>&1 | awk -F, 'NR>1 && $1+0<prev {print "BACKWARD",NR,prev,$1} {prev=$1+0}' | head -n 30 || true
echo '=== engine warnings since audio change ==='
sudo docker logs --since 30m gsa-tv-encoder-engine 2>&1 | grep -Ei 'audio|timestamp|non.monoton|queue|drop|error|invalid|discontinu|aac' | tail -n 150 || true
`, 240000);
process.stdout.write(r.stdout);
if (r.stderr) process.stderr.write(r.stderr);
