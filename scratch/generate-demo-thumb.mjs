import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo docker exec gsa-tv-control-plane ffmpeg -nostdin -hide_banner -loglevel error -y \
  -ss 00:00:03 -i /media/1/identity/vinhetas/vinheta-gsa-manha-news-clean-master.mp4 \
  -frames:v 1 -vf "scale=640:360:force_original_aspect_ratio=increase,crop=640:360" -q:v 3 \
  /media/1/thumbnails/media-demo-manha-news-clean.jpg
ls -lh /opt/gsa-tv/cache/media/1/thumbnails/media-demo-manha-news-clean.jpg
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
