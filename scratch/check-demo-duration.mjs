import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo docker exec gsa-tv-ffplayout ffprobe -v error -show_entries format=duration,bit_rate -of default=noprint_wrappers=1 /media/1/identity/vinhetas/vinheta-gsa-manha-news-clean-demo.mp4
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
