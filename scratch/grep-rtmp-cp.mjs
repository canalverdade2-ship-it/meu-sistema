import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
grep -rn "rtmp" /opt/gsa-tv/control-plane/src/ | head -15
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
