import fs from 'fs';
import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error \
  -ss 3.5 -i /media/1/identity/vinhetas/vinheta-ta-na-rede-opcao1-premium.mp4 \
  -vframes 1 /media/1/identity/vinhetas/preview_opcao1.jpg

sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error \
  -ss 3.5 -i /media/1/identity/vinhetas/vinheta-ta-na-rede-opcao2-kinetic.mp4 \
  -vframes 1 /media/1/identity/vinhetas/preview_opcao2.jpg

base64 -w 0 /opt/gsa-tv/cache/media/1/identity/vinhetas/preview_opcao1.jpg
echo "---SPLIT---"
base64 -w 0 /opt/gsa-tv/cache/media/1/identity/vinhetas/preview_opcao2.jpg
`;

  const res = await runSshScript(script);
  const parts = res.stdout.trim().split('---SPLIT---');
  const b1 = parts[0].trim().split('\n').pop();
  const b2 = parts[1].trim().split('\n').pop();

  fs.writeFileSync('public/cast/preview_opcao1_premium.jpg', Buffer.from(b1, 'base64'));
  fs.writeFileSync('public/cast/preview_opcao2_kinetic.jpg', Buffer.from(b2, 'base64'));
  console.log('Saved preview_opcao1_premium.jpg and preview_opcao2_kinetic.jpg!');
}

main().catch(console.error);
