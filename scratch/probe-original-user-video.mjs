import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo docker exec gsa-tv-ffplayout ffprobe -v error -show_entries stream=width,height,duration,r_frame_rate -of default=noprint_wrappers=1 /media/1/incoming/media-58eba934-bf86-45bb-a6ab-16f83aa4ab63.mp4
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
