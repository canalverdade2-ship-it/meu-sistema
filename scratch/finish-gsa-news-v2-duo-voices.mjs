import {runSshScript} from './ssh2-run.mjs';const remote=String.raw`set -euo pipefail
for id in escalada encerramento; do
  file=/opt/gsa-tv/cache/media/1/news/gsa-news-2026-09-01-v2/work/duo-$id/concat.txt
  sudo sed -i 's#/opt/gsa-tv/cache/media#/media#g' "$file"
  sudo docker run --rm --user 0 -v /opt/gsa-tv/cache/media:/media gsa-tv/control-plane:1.6.13 ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i "/media/1/news/gsa-news-2026-09-01-v2/work/duo-$id/concat.txt" -ar 48000 -ac 2 -c:a pcm_s16le "/media/1/news/gsa-news-2026-09-01-v2/audio/$id.wav"
  echo duo_converted=$id
done
sudo chown -R 989:986 /opt/gsa-tv/cache/media/1/news/gsa-news-2026-09-01-v2/audio /opt/gsa-tv/cache/media/1/news/gsa-news-2026-09-01-v2/work
`;const r=await runSshScript(remote,300000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
