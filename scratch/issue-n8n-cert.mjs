import { runSshScript } from './ssh2-run.mjs';
const host='n8n.147-15-43-141.nip.io';
const r=await runSshScript(`
set -euo pipefail
/home/opc/.acme.sh/acme.sh --issue --server letsencrypt --keylength ec-256 -d '${host}' -w /usr/share/nginx/html
certdir="/home/opc/.acme.sh/${host}_ecc"
test -s "$certdir/${host}.key"
test -s "$certdir/fullchain.cer"
sudo install -m 0600 "$certdir/${host}.key" /etc/nginx/ssl/n8n.key
sudo install -m 0644 "$certdir/fullchain.cer" /etc/nginx/ssl/n8n.cer
sudo openssl x509 -in /etc/nginx/ssl/n8n.cer -noout -subject -issuer -dates -ext subjectAltName
` , 180000);
process.stdout.write(r.stdout);process.stderr.write(r.stderr);
