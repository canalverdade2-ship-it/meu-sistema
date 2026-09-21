import { runSshScript } from './ssh2-run.mjs';
const result=await runSshScript(`set -eu\nchmod +x /home/opc/gsa-ai/work/chamada-grade-v2/render-presenter-pass-vps.sh\n/home/opc/gsa-ai/work/chamada-grade-v2/render-presenter-pass-vps.sh`,900000);
process.stdout.write(result.stdout); process.stderr.write(result.stderr);
