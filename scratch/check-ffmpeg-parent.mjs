import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
ps -o pid,ppid,user,args -p 1480208,1480217
ps -o pid,ppid,user,args -p $(ps -o ppid= -p 1480208)
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
