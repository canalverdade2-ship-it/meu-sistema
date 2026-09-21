import { runSshScript } from './ssh2-run.mjs';
const host='n8n.147-15-43-141.nip.io';
const r=await runSshScript(`
set -euo pipefail
sudo install -d -m 0755 /var/www/acme
sudo tee /etc/nginx/conf.d/n8n-acme.conf >/dev/null <<'NGINX'
server {
    listen 80;
    server_name ${host};
    location /.well-known/acme-challenge/ { root /var/www/acme; }
    location / { return 302 https://$host$request_uri; }
}
NGINX
sudo nginx -t
sudo systemctl reload nginx
curl -fsS -H 'Host: ${host}' http://127.0.0.1/ -o /dev/null -w 'http_host=%{http_code}\n'
`);
process.stdout.write(r.stdout);process.stderr.write(r.stderr);