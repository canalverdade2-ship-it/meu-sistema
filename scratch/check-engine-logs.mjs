import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo docker logs --tail 40 gsa-tv-encoder-engine
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
