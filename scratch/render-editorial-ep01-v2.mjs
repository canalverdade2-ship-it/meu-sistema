import { runSshScript } from './ssh2-run.mjs';
const script=String.raw`set -euo pipefail
work=/tmp/gsa-tv-editorial
out=$work/rendered-v2
sudo rm -rf "$out"
sudo install -d -m 0775 -o 1000 -g 1000 "$out"
for n in 01 02 03 04 05 06 07 08 09; do
 duration=$(sudo docker run --rm -v "$work:/work:ro" gsa-tv/control-plane:1.6.8 ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "/work/voice-$n.wav")
 total=$(awk -v d="$duration" 'BEGIN{printf "%.3f",d+0.4}')
 echo "segment=$n voice=$duration total=$total"
 sudo docker run --rm --user 0 -v "$work:/work" gsa-tv/control-plane:1.6.8 ffmpeg -hide_banner -loglevel error -y \
   -loop 1 -i "/work/slide-$n.png" -i "/work/voice-$n.wav" -t "$total" \
   -vf "fps=30,format=yuv420p" -af "apad=pad_dur=0.4" \
   -c:v libx264 -preset veryfast -profile:v high -level 4.0 -g 60 -keyint_min 60 -sc_threshold 0 \
   -b:v 2500k -minrate 2500k -maxrate 2500k -bufsize 5000k -x264-params 'nal-hrd=cbr:force-cfr=1:filler=1' \
   -c:a aac -b:a 128k -ar 48000 -ac 2 -movflags +faststart "/work/rendered-v2/segment-$n.mp4"
done
`;
const r=await runSshScript(script,300000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
