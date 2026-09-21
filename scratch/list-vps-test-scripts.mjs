import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
ls -lat /home/opc/*.mjs /home/opc/*.js /home/opc/*.sh /home/opc/*.py 2>/dev/null | head -15
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
