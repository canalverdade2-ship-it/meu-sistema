import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo docker exec gsa-tv-ffplayout ffprobe -i /fallback/gsa-tv-fallback-720p30.mp4 -show_streams -v quiet -of json || ffprobe -i /opt/gsa-tv/fallback/gsa-tv-fallback-720p30.mp4 -show_streams -v quiet -of json
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
