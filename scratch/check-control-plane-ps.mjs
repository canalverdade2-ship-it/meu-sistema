import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo docker exec gsa-tv-control-plane ps aux
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
