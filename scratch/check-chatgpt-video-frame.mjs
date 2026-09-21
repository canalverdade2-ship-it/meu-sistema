import { runSshScript } from './ssh2-run.mjs';
import fs from 'fs/promises';

async function main() {
  const script = `
sudo docker exec gsa-tv-ffplayout ffmpeg -nostdin -hide_banner -loglevel error -y \
  -ss 00:00:15 -i /media/1/normalized/media-gsa-manha-news-2026-09-04-draft-qc-v1-720p30.mp4 \
  -frames:v 1 -q:v 2 /media/1/thumbnails/test_chatgpt_draft_15s.jpg
sudo cat /opt/gsa-tv/cache/media/1/thumbnails/test_chatgpt_draft_15s.jpg | base64 -w 0
`;
  const res = await runSshScript(script);
  const buf = Buffer.from(res.stdout.trim(), 'base64');
  await fs.writeFile('public/cast/test_chatgpt_draft_15s.jpg', buf);
  console.log('Salvo frame test_chatgpt_draft_15s.jpg, tamanho:', buf.length);
}

main().catch(console.error);
