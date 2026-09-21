import { runSshScript } from './ssh2-run.mjs';
import fs from 'fs/promises';
import path from 'path';

async function main() {
  const script = `
sudo cat /opt/gsa-tv/cache/media/1/identity/vinhetas/frame9_raw.png | base64 -w 0
`;
  const res = await runSshScript(script);
  const buf = Buffer.from(res.stdout.trim(), 'base64');
  await fs.writeFile('public/cast/frame9_raw.png', buf);
  console.log('Salvo em public/cast/frame9_raw.png, tamanho:', buf.length);
}

main().catch(console.error);
