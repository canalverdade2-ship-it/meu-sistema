import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const res = await runSshScript('sudo docker ps --format "table {{.Names}}\t{{.Status}}"');
  console.log('CONTAINERS:\n', res.stdout);
}

main().catch(console.error);
