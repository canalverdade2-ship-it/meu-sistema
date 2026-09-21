import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`
set -euo pipefail
sudo python3 - <<'PY'
p='/etc/nginx/nginx.conf'; s=open(p).read()
s=s.replace('location ^~ /.well-known/acme-challenge/ { alias /usr/share/nginx/html/.well-known/acme-challenge/; add_header X-ACME yes always; }','location ^~ /.well-known/acme-challenge/ { root /usr/share/nginx/html; add_header X-ACME yes always; }')
open(p,'w').write(s)
PY
sudo nginx -t && sudo systemctl reload nginx
name=probe-$(date +%s); printf ok > /usr/share/nginx/html/.well-known/acme-challenge/$name
curl -sS -D - -o /tmp/acme-probe -H 'Host: n8n.147-15-43-141.nip.io' http://127.0.0.1/.well-known/acme-challenge/$name | head -10
echo "body=$(cat /tmp/acme-probe)"
rm -f /usr/share/nginx/html/.well-known/acme-challenge/$name /tmp/acme-probe
`);
process.stdout.write(r.stdout);process.stderr.write(r.stderr);