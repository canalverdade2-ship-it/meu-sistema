import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo docker exec gsa-tv-ffplayout ffprobe -v error -show_entries format=duration,bit_rate -of default=noprint_wrappers=1 /media/1/identity/vinhetas/media-vinheta-gsa-manha-news.wav
sudo docker exec gsa-tv-ffplayout ffprobe -v error -show_entries format=duration,bit_rate -of default=noprint_wrappers=1 /media/1/identity/vinhetas/vinheta_master_audio.wav
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
