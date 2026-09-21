import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo ls -la /opt/gsa-tv/control-plane/
sudo cat /opt/gsa-tv/control-plane/compose.yml
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
