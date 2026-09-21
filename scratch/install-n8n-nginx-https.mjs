import { runSshScript } from './ssh2-run.mjs';
const host='n8n.147-15-43-141.nip.io';
const block=`    server {
        listen 443 ssl;
        server_name ${host};
        ssl_certificate /etc/nginx/ssl/n8n.cer;
        ssl_certificate_key /etc/nginx/ssl/n8n.key;
        ssl_protocols TLSv1.2 TLSv1.3;
        client_max_body_size 50M;
        location / {
            proxy_pass http://127.0.0.1:5678;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
            proxy_read_timeout 3600s;
        }
    }
`;
const b64=Buffer.from(block).toString('base64');
const r=await runSshScript(`set -euo pipefail
stamp=$(date +%Y%m%d%H%M%S)
sudo cp -a /etc/nginx/nginx.conf /etc/nginx/nginx.conf.pre-n8n-$stamp
printf '%s' '${b64}' | base64 -d >/tmp/n8n-https-block.conf
sudo python3 - <<'PY'
p='/etc/nginx/nginx.conf'; s=open(p).read(); block=open('/tmp/n8n-https-block.conf').read()
if 'ssl_certificate /etc/nginx/ssl/n8n.cer;' not in s:
    pos=s.rfind('}')
    if pos < 0: raise SystemExit('nginx closing brace not found')
    s=s[:pos]+block+s[pos:]
s=s.replace(' add_header X-ACME yes always;','')
open(p,'w').write(s)
PY
if ! sudo nginx -t; then sudo cp -a /etc/nginx/nginx.conf.pre-n8n-$stamp /etc/nginx/nginx.conf; exit 1; fi
sudo systemctl reload nginx
curl -fsS --resolve '${host}:443:127.0.0.1' https://${host}/healthz -o /tmp/n8n-health
echo "https_health=$(cat /tmp/n8n-health)"
`);
process.stdout.write(r.stdout);process.stderr.write(r.stderr);