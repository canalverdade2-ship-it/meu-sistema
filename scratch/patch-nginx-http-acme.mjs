import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`
set -euo pipefail
stamp=$(date +%Y%m%d%H%M%S)
sudo cp -a /etc/nginx/nginx.conf /etc/nginx/nginx.conf.pre-acme-$stamp
sudo python3 - <<'PY'
p='/etc/nginx/nginx.conf'
s=open(p).read()
old='''    server {\n        listen 80;\n        server_name api.147-15-43-141.nip.io;\n        return 301 https://$host$request_uri;\n    }'''
new='''    server {\n        listen 80;\n        server_name api.147-15-43-141.nip.io n8n.147-15-43-141.nip.io;\n        location /.well-known/acme-challenge/ { root /var/www/acme; }\n        location / { return 301 https://$host$request_uri; }\n    }'''
if old not in s: raise SystemExit('http server marker not found')
open(p,'w').write(s.replace(old,new,1))
PY
sudo nginx -t
sudo systemctl reload nginx
name=probe-$(date +%s); printf ok > /var/www/acme/.well-known/acme-challenge/$name
code=$(curl -sS -o /tmp/acme-probe -w '%{http_code}' -H 'Host: n8n.147-15-43-141.nip.io' http://127.0.0.1/.well-known/acme-challenge/$name)
echo "challenge_http=$code|body=$(cat /tmp/acme-probe)"
rm -f /var/www/acme/.well-known/acme-challenge/$name /tmp/acme-probe
`);
process.stdout.write(r.stdout);process.stderr.write(r.stderr);