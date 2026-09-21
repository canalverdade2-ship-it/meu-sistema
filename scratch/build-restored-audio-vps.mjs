import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
IN=/media/1/normalized/media-836c5fe7-e994-455c-bfa4-76b5a803d94c-720p30.mp4
OUT=/media/1/normalized/media-836c5fe7-e994-455c-bfa4-76b5a803d94c-720p30-audio-restored.mp4
FILTER='highpass=f=55,lowpass=f=14500,afftdn=nr=12:nf=-38:tn=1,adeclick=w=35:o=85:a=2:t=3:b=3,adeclick=w=55:o=85:a=2:t=3:b=3,equalizer=f=4200:t=q:w=0.7:g=-3.5,afade=t=in:st=0:d=0.03,afade=t=out:st=34.62:d=0.09,alimiter=limit=0.78:attack=5:release=80:level=false'
sudo docker exec gsa-tv-control-plane ffmpeg -y -hide_banner -nostdin -v error -i "$IN" -map 0:v:0 -map 0:a:0 -c:v copy -af "$FILTER" -c:a aac -b:a 192k -ar 48000 -ac 2 -movflags +faststart "$OUT"
echo '=== restored metrics ==='
sudo docker exec gsa-tv-encoder-engine ffmpeg -hide_banner -nostdin -i "$OUT" -map 0:a:0 -af 'adeclick=w=55:o=75:a=2:t=2:b=2,ebur128=peak=true' -f null - 2>&1 | grep -E 'Detected clicks|I:|LRA:|Peak:' | tail -n 8
sudo docker exec gsa-tv-encoder-engine ffmpeg -v error -xerror -i "$OUT" -map 0 -f null -
echo RESTORED_FILE_PASS
`,240000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
