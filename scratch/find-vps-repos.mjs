import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
ls -la /home/opc
find /home/opc -name "Dockerfile" 2>/dev/null
find /opt/gsa-tv -maxdepth 2
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
