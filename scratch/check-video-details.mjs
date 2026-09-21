import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo docker exec gsa-tv-ffplayout ffprobe -v error -show_entries format=duration,size:stream=width,height,codec_name -of json /media/1/news/gsa-news-2026-09-01-v2/motion/tecnologia.webm
sudo docker exec gsa-tv-ffplayout ffprobe -v error -show_entries format=duration,size:stream=width,height,codec_name -of json /media/1/news/gsa-news-2026-09-01-v2/video/vinheta-veo.mp4
sudo docker exec gsa-tv-ffplayout ffprobe -v error -show_entries format=duration,size:stream=width,height,codec_name -of json /media/1/filler/filler.mp4
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
