import { runSshScript } from './ssh2-run.mjs';

const script = String.raw`
set -eu
find /home/opc/gsa-ai/work/chamada-grade-v2 -maxdepth 3 -type f -printf '%p\n' | sort | sed -n '1,320p'
`;

const result = await runSshScript(script);
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
