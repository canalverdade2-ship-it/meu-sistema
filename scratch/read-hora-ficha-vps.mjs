import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`cat /home/opc/gsa-ai/docs/programas/GSA_HORA_DA_PALAVRA_FICHA.md; tail -n 180 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md`);
process.stdout.write(r.stdout); process.stderr.write(r.stderr);
