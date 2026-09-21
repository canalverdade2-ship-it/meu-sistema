import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo docker exec gsa-tv-control-plane which ffmpeg ffprobe
sudo docker exec gsa-tv-control-plane ffmpeg -version | head -n 2
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
