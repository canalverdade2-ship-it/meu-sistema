import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const res = await runSshScript(`
    docker inspect gsa-tv-control-plane | grep -B 2 -A 5 '"Type": "bind"' || true
  `);
  console.log(res.stdout);
}

main().catch(console.error);
