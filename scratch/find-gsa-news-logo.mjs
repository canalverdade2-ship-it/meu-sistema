import { runSshScript } from './ssh2-run.mjs';

const command = String.raw`find /home/opc/gsa-ai/assets/brand -maxdepth 3 -type f 2>/dev/null | sort`;
const result = await runSshScript(command);
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
