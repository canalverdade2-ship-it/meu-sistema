import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo docker logs --tail 30 gsa-tv-control-plane
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
  if (res.stderr) console.error(res.stderr);
}

main().catch(console.error);
