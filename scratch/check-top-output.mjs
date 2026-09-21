import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
    top -b -n 1 | head -n 20
  `;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
