import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const cmd = `sudo docker exec gsa-tv-control-plane grep -n -C 5 "media-preview" /app/src/app.js`;
  const res = await runSshScript(cmd);
  console.log('STDOUT:', res.stdout);
}

main().catch(console.error);
