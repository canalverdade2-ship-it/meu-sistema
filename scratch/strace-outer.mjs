import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo strace -p 1480208 -c -f sleep 2 2>&1
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
