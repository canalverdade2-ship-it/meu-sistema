import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const cmd = `sudo docker exec gsa-tv-control-plane pwd && sudo docker exec gsa-tv-control-plane ls -la`;
  const res = await runSshScript(cmd);
  console.log('STDOUT:', res.stdout);
}

main().catch(console.error);
