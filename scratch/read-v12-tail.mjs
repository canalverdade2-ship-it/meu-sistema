import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
tail -n 40 /home/opc/gsa-ai/render_v12_broadcast.sh
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
