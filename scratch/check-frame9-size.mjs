import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo ls -lh /opt/gsa-tv/cache/media/1/identity/vinhetas/frame9_raw.png
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
  if (res.stderr) console.error(res.stderr);
}

main().catch(console.error);
