import {runSshScript} from './ssh2-run.mjs';const remote=String.raw`set -euo pipefail
root=/opt/gsa-tv/cache/media/1/news/gsa-news-2026-09-01-v2/audio
sudo find "$root" -maxdepth 1 -type f -name '*.mp3' -printf '%f\n' | while read -r name; do
  base=$(basename "$name" .mp3)
  sudo docker run --rm --user 0 -v /opt/gsa-tv/cache/media:/media gsa-tv/control-plane:1.6.13 ffmpeg -hide_banner -loglevel error -y -i "/media/1/news/gsa-news-2026-09-01-v2/audio/$name" -ar 48000 -ac 2 -c:a pcm_s16le "/media/1/news/gsa-news-2026-09-01-v2/audio/$base.wav"
  echo converted=$base
done
sudo chown -R 989:986 "$root"
`;const r=await runSshScript(remote,600000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
