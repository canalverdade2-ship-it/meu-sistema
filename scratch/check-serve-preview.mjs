import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const cmd = `sudo docker exec gsa-tv-control-plane grep -n -A 35 "async function serveMediaPreview" /app/src/app.js`;
  const res = await runSshScript(cmd);
  console.log('STDOUT:', res.stdout);
}

main().catch(console.error);
