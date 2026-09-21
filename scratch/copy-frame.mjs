import fs from 'fs';
import { runSshScript } from './ssh2-run.mjs';

async function copyFrame() {
  const res = await runSshScript('base64 -w 0 /opt/gsa-tv/cache/media/1/news/gsa-ta-na-rede-2026-09-02/test_frame.jpg');
  const buffer = Buffer.from(res.stdout.trim(), 'base64');
  fs.writeFileSync('public/cast/test_frame.jpg', buffer);
  console.log('Frame copiado para public/cast/test_frame.jpg:', buffer.length, 'bytes');
}

copyFrame().catch(console.error);
