import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo docker exec gsa-tv-encoder-engine ffmpeg -hide_banner -nostdin -loglevel info -t 2 -re -i /fallback/gsa-tv-fallback-720p30.mp4 -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black" -c:v libx264 -preset ultrafast -tune zerolatency -r 30 -g 60 -b:v 6000k -minrate 6000k -maxrate 6000k -bufsize 12000k -pix_fmt yuv420p -c:a aac -b:a 128k -ar 48000 -ac 2 -f null -
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
  if (res.stderr) console.error(res.stderr);
}

main().catch(console.error);
