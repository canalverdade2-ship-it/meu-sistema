import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
    tail -n 60 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md || true
  `;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
