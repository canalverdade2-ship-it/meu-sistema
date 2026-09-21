import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
ls -lh /opt/gsa-tv/cache/media/1/news/gsa-ta-na-rede-2026-09-02/video/
sudo docker exec gsa-tv-ffplayout ffprobe -v error -show_entries format=duration,size,bit_rate:stream=width,height,codec_name -of json /media/1/news/gsa-ta-na-rede-2026-09-02/video/gsa-ta-na-rede-final.mp4
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
