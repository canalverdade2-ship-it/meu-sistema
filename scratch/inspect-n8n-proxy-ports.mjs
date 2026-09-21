import { runSshScript } from './ssh2-run.mjs';
const script=`set -euo pipefail
echo '=== nginx-n8n ==='
sudo grep -R -n -E 'n8n\.gsahub\.com\.br|127\.0\.0\.1:5678|localhost:5678' /etc/nginx 2>/dev/null | head -40 || true
echo '=== 5679/5680 listeners ==='
ss -ltnp 2>/dev/null | grep -E ':(5679|5680)\\b' || true
echo '=== docker ports matching ==='
docker ps --format '{{.Names}}|{{.Ports}}' | grep -E '5679|5680' || true
echo '=== public n8n ==='
curl -k -sS -o /dev/null -w 'https=%{http_code}\n' https://n8n.gsahub.com.br/
curl -sS -o /dev/null -w 'local5678=%{http_code}\n' http://127.0.0.1:5678/
`;
const r=await runSshScript(script,90000);process.stdout.write(r.stdout);process.stderr.write(r.stderr);
