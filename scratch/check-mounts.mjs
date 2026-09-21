import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `sudo docker inspect gsa-tv-control-plane --format '{{range .Mounts}}{{println .Source " -> " .Destination " (ro=" .RW ")"}}{{end}}'`;
  const res = await runSshScript(script);
  console.log('MOUNTS:\n', res.stdout);
}

main().catch(console.error);
