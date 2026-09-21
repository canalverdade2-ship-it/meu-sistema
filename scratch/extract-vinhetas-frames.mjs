import fs from 'fs';
import { runSshScript } from './ssh2-run.mjs';

const VINHETAS = [
  { id: 'vinheta_ta_na_rede', file: 'vinheta-gsa-ta-na-rede.mp4' },
  { id: 'vinheta_news', file: 'vinheta-gsa-news.mp4' },
  { id: 'vinheta_financeiro', file: 'vinheta-gsa-boletim-financeiro.mp4' },
  { id: 'vinheta_manha', file: 'vinheta-gsa-manha-news.mp4' },
];

async function extractFrames() {
  for (const v of VINHETAS) {
    const script = `
sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error \
  -ss 3 -i /media/1/identity/vinhetas/${v.file} \
  -vframes 1 /media/1/identity/vinhetas/${v.id}_frame.jpg

base64 -w 0 /opt/gsa-tv/cache/media/1/identity/vinhetas/${v.id}_frame.jpg
`;
    const res = await runSshScript(script);
    const buffer = Buffer.from(res.stdout.trim(), 'base64');
    fs.writeFileSync(`public/cast/${v.id}_frame.jpg`, buffer);
    console.log(`Saved public/cast/${v.id}_frame.jpg (${buffer.length} bytes)`);
  }
}

extractFrames().catch(console.error);
