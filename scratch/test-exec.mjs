import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo docker exec gsa-tv-control-plane ls -la /tmp/update_mutate.js || echo "not found"
sudo docker exec gsa-tv-control-plane node /tmp/update_mutate.js 2>&1
`;
  const res = await runSshScript(script);
  console.log('OUTPUT:\n', res.stdout, res.stderr);
}

main().catch(console.error);
