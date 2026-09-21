import { runSshScript } from './ssh2-run.mjs';
const result = await runSshScript(`sudo sed -n '1,115p' /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md`, 30000);
process.stdout.write(result.stdout || '');
