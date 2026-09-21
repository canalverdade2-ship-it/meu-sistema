import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
    top -b -n 1 | wc -l
    echo "Total processes in ps:"
    ps -e | wc -l
  `;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
