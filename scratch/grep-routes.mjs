import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
grep -n -C 20 "createServer" /opt/gsa-tv/encoder-engine/src/app.js
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
