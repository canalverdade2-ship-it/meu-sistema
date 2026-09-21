import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo docker inspect gsa-tv-control-plane --format '{{json .Mounts}}'
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
