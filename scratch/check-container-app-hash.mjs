import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo docker exec gsa-tv-control-plane wc -l /app/src/app.js
sudo docker exec gsa-tv-control-plane sha256sum /app/src/app.js
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
