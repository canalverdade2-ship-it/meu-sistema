import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo docker exec gsa-tv-control-plane ls -la /app
sudo docker exec gsa-tv-control-plane node -v
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
