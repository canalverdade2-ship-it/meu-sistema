import { runSshScript } from './ssh2-run.mjs';
const remote=String.raw`set -e
printf '%s\n' '=== sensitive-key-names ==='
python3 - <<'PY'
import re
p='/home/opc/gsa-hub/docker-compose.yml'
for i,line in enumerate(open(p,encoding='utf-8'),1):
    if re.search(r'password|secret|token|encryption|api[_-]?key|credential',line,re.I):
        m=re.search(r'([A-Za-z0-9_]*(?:PASSWORD|SECRET|TOKEN|ENCRYPTION_KEY|API_KEY|CREDENTIAL)[A-Za-z0-9_]*)\s*[:=]',line,re.I)
        print(f'{i}: {m.group(1) if m else "sensitive-setting"}')
PY
printf '%s\n' '=== nginx refs to 5678 ==='
sudo grep -RIl '127.0.0.1:5678\|localhost:5678\|:5678' /etc/nginx /etc/nginx/conf.d /etc/nginx/default.d 2>/dev/null || true
printf '%s\n' '=== firewall 5678 ==='
sudo firewall-cmd --list-ports 2>/dev/null | tr ' ' '\n' | grep '^5678/' || true
printf '%s\n' '=== n8n webhook/host env names ==='
sudo docker inspect n8n --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1 ~ /^N8N_(HOST|PORT|PROTOCOL|WEBHOOK_URL)$/ {print $1"=<set>"}'
`;
const r=await runSshScript(remote,30000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
