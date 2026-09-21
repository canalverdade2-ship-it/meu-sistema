import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
ls -la /opt/gsa-tv/runtime/
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
