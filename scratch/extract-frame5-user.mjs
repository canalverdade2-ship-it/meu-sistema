import { runSshScript } from './ssh2-run.mjs';
import fs from 'fs/promises';

async function main() {
  const script = `
sudo docker exec gsa-tv-ffplayout ffmpeg -nostdin -hide_banner -loglevel error -y \
  -ss 00:00:05 -i /media/1/incoming/media-58eba934-bf86-45bb-a6ab-16f83aa4ab63.mp4 \
  -frames:v 1 -q:v 2 /media/1/thumbnails/frame5_user_orig.jpg
sudo cat /opt/gsa-tv/cache/media/1/thumbnails/frame5_user_orig.jpg | base64 -w 0
`;
  const res = await runSshScript(script);
  const buf = Buffer.from(res.stdout.trim(), 'base64');
  await fs.writeFile('public/cast/frame5_user_orig.jpg', buf);
  console.log('Salvo frame5_user_orig.jpg, tamanho:', buf.length);
}

main().catch(console.error);
