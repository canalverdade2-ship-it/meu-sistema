import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
head -n 60 /home/opc/gsa-ai/create_vids_02sep.js
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
