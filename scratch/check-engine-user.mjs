import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
cat /opt/gsa-tv/encoder-engine/Dockerfile
sudo docker exec gsa-tv-encoder-engine id
sudo docker exec gsa-tv-encoder-engine ls -l /fallback/gsa-tv-fallback-720p30.mp4
sudo docker exec gsa-tv-encoder-engine head -c 10 /fallback/gsa-tv-fallback-720p30.mp4 | wc -c
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
  if (res.stderr) console.error(res.stderr);
}

main().catch(console.error);
