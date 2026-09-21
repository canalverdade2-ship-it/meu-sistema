import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`
set -euo pipefail
echo '=== conf file ==='; sudo cat /etc/nginx/conf.d/n8n-acme.conf
echo '=== effective n8n ==='; sudo nginx -T 2>&1 | grep -n -A12 -B4 'n8n.147-15-43-141.nip.io' || true
echo '=== includes ==='; sudo grep -n 'conf.d' /etc/nginx/nginx.conf || true
echo '=== curl verbose ==='; curl -sv -H 'Host: n8n.147-15-43-141.nip.io' http://127.0.0.1/.well-known/acme-challenge/test 2>&1 | head -30 || true
`);
process.stdout.write(r.stdout);process.stderr.write(r.stderr);