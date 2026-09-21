import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`
set -euo pipefail
sudo install -d -o opc -g opc -m 0755 /var/www/acme/.well-known/acme-challenge
sudo chown opc:opc /var/www/acme
name=probe-$(date +%s)
printf ok > /var/www/acme/.well-known/acme-challenge/$name
code=$(curl -sS -o /tmp/acme-probe -w '%{http_code}' -H 'Host: n8n.147-15-43-141.nip.io' http://127.0.0.1/.well-known/acme-challenge/$name)
echo "challenge_http=$code|body=$(cat /tmp/acme-probe)"
rm -f /var/www/acme/.well-known/acme-challenge/$name /tmp/acme-probe
`);
process.stdout.write(r.stdout);process.stderr.write(r.stderr);