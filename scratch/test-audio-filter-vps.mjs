import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
FILE=/media/1/normalized/media-836c5fe7-e994-455c-bfa4-76b5a803d94c-720p30.mp4
FILTER='aresample=async=1000:first_pts=0,highpass=f=45,lowpass=f=15500,equalizer=f=4500:t=q:w=0.8:g=-2.5,adeclick=w=55:o=75:a=2:t=2:b=2,alimiter=limit=0.82:attack=5:release=50:level=false'
sudo docker exec gsa-tv-encoder-engine ffmpeg -hide_banner -nostdin -v error -i "$FILE" -map 0:a:0 -af "$FILTER" -f null -
echo FILTER_EXECUTION_PASS
sudo docker exec gsa-tv-encoder-engine ffmpeg -hide_banner -nostdin -i "$FILE" -map 0:a:0 -af "$FILTER,ebur128=peak=true" -f null - 2>&1 | tail -n 18
`,180000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
