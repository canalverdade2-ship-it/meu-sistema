import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const res = await runSshScript('which psql || echo "psql not on host"');
  console.log('PSQL:', res.stdout);
}

main().catch(console.error);
