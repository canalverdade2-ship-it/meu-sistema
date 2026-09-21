import fs from 'fs';
import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const frames = ['frame_04s.jpg', 'frame_flash.jpg', 'frame_25s.jpg', 'frame_50s.jpg'];
  for (const f of frames) {
    const res = await runSshScript(`base64 -w 0 /opt/gsa-tv/cache/media/1/identity/vinhetas/${f}`);
    const buf = Buffer.from(res.stdout.trim().split('\n').pop(), 'base64');
    fs.writeFileSync(`public/cast/${f}`, buf);
    console.log(`Saved public/cast/${f} (${buf.length} bytes)`);
  }
}

main().catch(console.error);
