import fs from 'node:fs';import {runSshScript} from './ssh2-run.mjs';
const presenter=fs.readFileSync(new URL('./gsa-news-2026-09-01/presenter-virtual.png',import.meta.url)).toString('base64');
const remote=String.raw`set -euo pipefail
root=/opt/gsa-tv/cache/media/1/news/gsa-news-2026-09-01
sudo install -d -m 0775 -o 989 -g 986 "$root/rendered"
printf '%s' '${presenter}' | base64 -d | sudo tee "$root/work/presenter-virtual.png" >/dev/null
sudo chown 989:986 "$root/work/presenter-virtual.png"; sudo chmod 0644 "$root/work/presenter-virtual.png"
render(){ id="$1"; slide="$2"; audio="$root/audio/$id.wav"; out="$root/rendered/$id.mp4";
 dur=$(sudo docker run --rm -v /opt/gsa-tv/cache/media:/media:ro gsa-tv/control-plane:1.6.7 ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "/media/1/news/gsa-news-2026-09-01/audio/$id.wav")
 total=$(awk -v d="$dur" 'BEGIN{printf "%.3f",d+0.45}')
 echo "render $id voice=$dur total=$total"
 sudo docker run --rm --user 0 -v /opt/gsa-tv/cache/media:/media gsa-tv/control-plane:1.6.7 ffmpeg -hide_banner -loglevel error -y \
  -loop 1 -i "/media/1/news/gsa-news-2026-09-01/work/$slide" -i "/media/1/news/gsa-news-2026-09-01/audio/$id.wav" -t "$total" \
  -vf "scale=1344:756,zoompan=z='min(zoom+0.00010,1.035)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1280x720:fps=30,format=yuv420p" \
  -af "apad=pad_dur=0.45,aresample=48000" -c:v libx264 -preset veryfast -profile:v high -level 4.0 -r 30 -g 60 -keyint_min 60 -sc_threshold 0 \
  -b:v 4000k -minrate 4000k -maxrate 4000k -bufsize 8000k -x264-params 'nal-hrd=cbr:force-cfr=1:filler=1' \
  -c:a aac -b:a 128k -ar 48000 -ac 2 -movflags +faststart "/media/1/news/gsa-news-2026-09-01/rendered/$id.mp4"
}
render intro presenter-virtual.png
render brasil slide-02-brasil.png
render mercados slide-03-mercados.png
render nepal slide-04-nepal.png
render onu slide-05-onu.png
render outro presenter-virtual.png
printf '%s\n' "file '/media/1/news/gsa-news-2026-09-01/rendered/intro.mp4'" "file '/media/1/news/gsa-news-2026-09-01/rendered/brasil.mp4'" "file '/media/1/news/gsa-news-2026-09-01/rendered/mercados.mp4'" "file '/media/1/news/gsa-news-2026-09-01/rendered/nepal.mp4'" "file '/media/1/news/gsa-news-2026-09-01/rendered/onu.mp4'" "file '/media/1/news/gsa-news-2026-09-01/rendered/outro.mp4'" | sudo tee "$root/concat.txt" >/dev/null
sudo docker run --rm --user 0 -v /opt/gsa-tv/cache/media:/media gsa-tv/control-plane:1.6.7 ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i /media/1/news/gsa-news-2026-09-01/concat.txt -c copy -movflags +faststart /media/1/news/gsa-news-2026-09-01/gsa-news-2026-09-01.mp4
echo '=== final probe ==='
sudo docker run --rm -v /opt/gsa-tv/cache/media:/media:ro gsa-tv/control-plane:1.6.7 ffprobe -v error -show_entries format=duration,size:stream=index,codec_name,codec_type,width,height,r_frame_rate,sample_rate,channels -of json /media/1/news/gsa-news-2026-09-01/gsa-news-2026-09-01.mp4
`;
const r=await runSshScript(remote,900000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
