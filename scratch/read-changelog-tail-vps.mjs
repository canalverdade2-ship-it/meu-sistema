import { runSshScript } from './ssh2-run.mjs';
const result=await runSshScript(`sudo tail -n 900 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md`,180000);
process.stdout.write(result.stdout); if(result.stderr)process.stderr.write(result.stderr);
