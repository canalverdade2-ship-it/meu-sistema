import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `node -v || /usr/local/bin/node -v || /root/.nvm/versions/node/*/bin/node -v`;
  const res = await runSshScript(script);
  console.log('NODE VERSION ON HOST:\n', res.stdout);
}

main().catch(console.error);
