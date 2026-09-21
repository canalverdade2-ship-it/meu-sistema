import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo ls -lh /media/1/enhanced/
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
