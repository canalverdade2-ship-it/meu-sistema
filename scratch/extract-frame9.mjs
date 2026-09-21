import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo docker exec gsa-tv-ffplayout ffmpeg -nostdin -hide_banner -loglevel error -y \
  -ss 00:00:09 -i /media/1/identity/vinhetas/vinheta-gsa-manha-news.mp4 \
  -frames:v 1 /media/1/identity/vinhetas/frame9_raw.png
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
