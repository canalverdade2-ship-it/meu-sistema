import { runSshScript } from './ssh2-run.mjs';
import fs from 'fs/promises';

async function main() {
  const script = `sudo cat /opt/gsa-tv/cache/media/1/thumbnails/test_orig_5s.jpg | base64 -w 0`;
  const res = await runSshScript(script);
  const buf = Buffer.from(res.stdout.trim(), 'base64');
  await fs.writeFile('public/cast/test_orig_5s.jpg', buf);
  console.log('Salvo public/cast/test_orig_5s.jpg, tamanho:', buf.length);
}

main().catch(console.error);
