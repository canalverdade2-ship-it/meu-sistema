import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`
set -euo pipefail
stamp=$(date +%Y%m%d%H%M%S)
sudo cp -a /etc/nginx/nginx.conf /etc/nginx/nginx.conf.pre-confd-$stamp
if ! sudo grep -qF 'include /etc/nginx/conf.d/*.conf;' /etc/nginx/nginx.conf; then
  sudo sed -i '/include \/etc\/nginx\/mime.types;/a\    include /etc/nginx/conf.d/*.conf;' /etc/nginx/nginx.conf
fi
if ! sudo nginx -t; then sudo cp -a /etc/nginx/nginx.conf.pre-confd-$stamp /etc/nginx/nginx.conf; exit 1; fi
sudo systemctl reload nginx
name=probe-$(date +%s); printf ok > /var/www/acme/.well-known/acme-challenge/$name
code=$(curl -sS -o /tmp/acme-probe -w '%{http_code}' -H 'Host: n8n.147-15-43-141.nip.io' http://127.0.0.1/.well-known/acme-challenge/$name)
echo "challenge_http=$code|body=$(cat /tmp/acme-probe)"
rm -f /var/www/acme/.well-known/acme-challenge/$name /tmp/acme-probe
`);
process.stdout.write(r.stdout);process.stderr.write(r.stderr);