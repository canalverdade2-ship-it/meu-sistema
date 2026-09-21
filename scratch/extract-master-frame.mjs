import fs from 'fs';
import { runSshScript } from './ssh2-run.mjs';

async function extractFrame() {
  const script = `
sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error \
  -ss 25 -i /media/1/news/gsa-ta-na-rede-2026-09-02/video/gsa-ta-na-rede-final.mp4 \
  -vframes 1 /media/1/news/gsa-ta-na-rede-2026-09-02/viral_preview_frame.jpg

base64 -w 0 /opt/gsa-tv/cache/media/1/news/gsa-ta-na-rede-2026-09-02/viral_preview_frame.jpg
`;

  const res = await runSshScript(script);
  const buffer = Buffer.from(res.stdout.trim(), 'base64');
  fs.writeFileSync('public/cast/viral_preview_frame.jpg', buffer);
  console.log('Frame do master viral salvo em public/cast/viral_preview_frame.jpg:', buffer.length, 'bytes');
}

extractFrame().catch(console.error);
