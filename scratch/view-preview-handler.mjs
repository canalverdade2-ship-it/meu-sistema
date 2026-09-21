import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo docker exec gsa-tv-control-plane sed -n '4215,4260p' /app/src/app.js
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
