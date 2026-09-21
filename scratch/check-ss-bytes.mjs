import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
ss -ti 'dport = :1935'
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
