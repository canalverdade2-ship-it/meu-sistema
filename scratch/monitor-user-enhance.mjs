import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
ps aux | grep -E "ffmpeg" | grep -v grep
sudo docker logs --tail 15 gsa-tv-control-plane
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
