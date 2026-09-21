import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
grep -n -C 5 "ENCODER_STATE_FILE" /opt/gsa-tv/encoder-engine/src/app.js
sudo docker exec gsa-tv-encoder-engine ls -la /runtime/
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
