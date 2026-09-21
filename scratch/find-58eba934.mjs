import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo find /opt/gsa-tv/cache/media/1/ -name "*58eba934*"
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
