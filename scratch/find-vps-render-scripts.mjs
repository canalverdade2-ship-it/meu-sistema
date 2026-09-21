import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
find /home/opc/ /opt/gsa-tv/ -name "*scene_01_abertura*" -o -name "*v12*" 2>/dev/null | head -20
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
