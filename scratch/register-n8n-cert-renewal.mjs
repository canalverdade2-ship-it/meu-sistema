import { runSshScript } from './ssh2-run.mjs';
const host='n8n.147-15-43-141.nip.io';
const r=await runSshScript(`set -euo pipefail
sudo chown opc:opc /etc/nginx/ssl/n8n.key /etc/nginx/ssl/n8n.cer
sudo chmod 0600 /etc/nginx/ssl/n8n.key
sudo chmod 0644 /etc/nginx/ssl/n8n.cer
/home/opc/.acme.sh/acme.sh --install-cert -d '${host}' --ecc \
  --key-file /etc/nginx/ssl/n8n.key \
  --fullchain-file /etc/nginx/ssl/n8n.cer \
  --reloadcmd 'sudo systemctl reload nginx'
sudo nginx -t
echo 'renewal_install=ok'
`);
process.stdout.write(r.stdout);process.stderr.write(r.stderr);