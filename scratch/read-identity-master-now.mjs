import { runSshScript } from './ssh2-run.mjs';

const result = await runSshScript("sed -n '1,260p' /home/opc/gsa-ai/docs/GSA_PROGRAM_IDENTITY_MASTER_2026-09-04.md", 60000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
