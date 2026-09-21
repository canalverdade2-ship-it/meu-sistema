import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
ls -la /opt/gsa-tv/cache/media/1/identity/vinhetas/
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
