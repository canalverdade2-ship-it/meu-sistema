import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
uname -m
cat /etc/os-release | head -n 3
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
