import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
ps -p 564726 -o %cpu,%mem,etime,cmd
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
