import {runSshScript} from './ssh2-run.mjs';const remote=String.raw`set -euo pipefail
src=$(sudo find /opt/gsa-tv/cache/media/1/news -type f \( -name 'opening-veo31-lite.mp4' -o -name 'opening*.mp4' \) -print -quit)
dst=/opt/gsa-tv/cache/media/1/news/gsa-news-2026-09-01-v2/video/vinheta-veo.mp4
sudo test -s "$src"; sudo cp "$src" "$dst"; sudo chown 989:986 "$dst"; sudo chmod 0644 "$dst"
sudo docker run --rm -v /opt/gsa-tv/cache/media:/media:ro gsa-tv/control-plane:1.6.13 ffprobe -v error -show_entries format=duration,size:stream=codec_name,codec_type,width,height -of json /media/1/news/gsa-news-2026-09-01-v2/video/vinheta-veo.mp4
`;const r=await runSshScript(remote,30000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
