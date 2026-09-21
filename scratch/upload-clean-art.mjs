import fs from 'fs/promises';
import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const localImg = 'C:/Users/Adriano Farias/.gemini/antigravity/brain/c6c9049f-c55a-4d14-9335-f1cc78667b6d/gsa_manha_clean_1788460313637.jpg';
  const imgBuf = await fs.readFile(localImg);
  await fs.writeFile('public/cast/gsa_manha_clean.jpg', imgBuf);
  console.log('Copiado para public/cast/gsa_manha_clean.jpg');

  // Enviar para a VPS
  const b64 = imgBuf.toString('base64');
  const script = `
echo "${b64}" | base64 -d | sudo tee /opt/gsa-tv/cache/media/1/identity/vinhetas/gsa_manha_clean_art.jpg > /dev/null
ls -lh /opt/gsa-tv/cache/media/1/identity/vinhetas/gsa_manha_clean_art.jpg
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
