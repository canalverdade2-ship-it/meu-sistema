import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`
set -euo pipefail
echo '=== file ==='; sudo sed -n '8,22p' /etc/nginx/nginx.conf
echo '=== master/workers ==='; ps -o pid,lstart,args -C nginx
echo '=== effective ==='; sudo nginx -T 2>&1 | sed -n '8,25p'
`);
process.stdout.write(r.stdout);process.stderr.write(r.stderr);