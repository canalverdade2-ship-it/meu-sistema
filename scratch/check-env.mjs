import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const res = await runSshScript('sudo docker exec gsa-tv-control-plane env | grep -E "DATABASE|POSTGRES"');
  console.log('ENV:\n', res.stdout);
}

main().catch(console.error);
