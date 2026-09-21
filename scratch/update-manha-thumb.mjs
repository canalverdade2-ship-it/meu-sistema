import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo docker exec gsa-tv-control-plane ffmpeg -nostdin -hide_banner -loglevel error -y \
  -ss 00:00:03 -i /media/1/identity/vinhetas/vinheta-gsa-manha-news.mp4 \
  -frames:v 1 -vf "scale=640:360:force_original_aspect_ratio=increase,crop=640:360" -q:v 3 \
  /media/1/thumbnails/media-vinheta-gsa-manha-news.jpg
`;
  const res = await runSshScript(script);
  console.log('Thumbnail atualizada!');
}

main().catch(console.error);
