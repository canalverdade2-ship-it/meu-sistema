import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
head -n 80 /home/opc/gsa-ai/render_v12_broadcast.sh
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
