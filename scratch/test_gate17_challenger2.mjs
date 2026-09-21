import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const res = await runSshScript(`tail -n 60 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md`);
  console.log(res.stdout);
}

main().catch(console.error);
