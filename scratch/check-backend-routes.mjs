import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const cmd = `sudo docker exec gsa-tv-control-plane node -e "
    const fs = require('fs');
    console.log(fs.readFileSync('/app/src/index.ts', 'utf8').slice(0, 3000));
  " 2>&1 || sudo docker exec gsa-tv-control-plane node -e "
    const fs = require('fs');
    console.log(fs.readFileSync('/app/index.js', 'utf8').slice(0, 3000));
  "`;
  const res = await runSshScript(cmd);
  console.log('STDOUT:', res.stdout.slice(0, 2000));
}

main().catch(console.error);
