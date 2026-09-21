import { runSshScript } from './ssh2-run.mjs';
import fs from 'fs/promises';

async function main() {
  const script = `
cat /opt/gsa-tv/cache/media/1/identity/vinhetas/vinheta_manha_frame.jpg | base64 -w 0
`;
  const res = await runSshScript(script);
  const buf = Buffer.from(res.stdout.trim(), 'base64');
  await fs.writeFile('public/cast/vinheta_manha_frame.jpg', buf);
  console.log('Salvo em public/cast/vinheta_manha_frame.jpg, tamanho:', buf.length);
}

main().catch(console.error);
