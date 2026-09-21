import { runSshScript } from './ssh2-run.mjs';
const script=`set -u
echo '=== certificate ==='
sudo openssl x509 -in /etc/nginx/ssl/fullchain.cer -noout -subject -issuer -ext subjectAltName 2>/dev/null || true
echo '=== certbot ==='
command -v certbot || true
echo '=== nip dns ==='
getent ahostsv4 n8n.147-15-43-141.nip.io | head -3 || true
echo '=== cloudflare credential names only ==='
sudo grep -R -h -E '^(CF_|CLOUDFLARE_)[A-Z0-9_]*=' /etc /home/opc 2>/dev/null | sed 's/=.*$/=<set>/' | sort -u | head -40 || true
`;
const r=await runSshScript(script,90000);process.stdout.write(r.stdout);process.stderr.write(r.stderr);
