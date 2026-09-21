import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo docker run --rm -v /opt/gsa-tv/fallback:/fallback:ro gsa-tv/control-plane:1.6.39 ffprobe -v error -show_entries stream=codec_type,codec_name -of json /fallback/gsa-tv-fallback-720p30.mp4
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
