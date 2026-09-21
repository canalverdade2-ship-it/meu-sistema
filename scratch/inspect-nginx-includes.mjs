import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`
set -euo pipefail
echo '=== includes ==='
sudo grep -nE '^[[:space:]]*include ' /etc/nginx/nginx.conf || true
echo '=== conf.d ==='
sudo find /etc/nginx/conf.d -maxdepth 1 -type f -printf '%f|%s\n' 2>/dev/null | sort || true
echo '=== first 25 ==='
sudo sed -n '1,25p' /etc/nginx/nginx.conf
`);
process.stdout.write(r.stdout);process.stderr.write(r.stderr);