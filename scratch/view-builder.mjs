import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const r = await runSshScript("sed -n '180,344p' /home/opc/gsa-program-builder/builder.py");
  console.log(r.stdout);
}

main().catch(console.error);
