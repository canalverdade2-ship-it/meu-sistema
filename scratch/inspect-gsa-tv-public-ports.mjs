import { runSshScript } from './ssh2-run.mjs';

const remote = String.raw`set -euo pipefail
echo PORTS
sudo docker ps --format '{{.Names}}|{{.Ports}}' | grep -E '^(n8n|evo-postgres)\|' || true
echo COMPOSE_LABELS
for c in n8n evo-postgres; do
  echo "$c"
  sudo docker inspect "$c" --format '{{json .Config.Labels}}'
done
echo FIREWALL
sudo firewall-cmd --state 2>/dev/null || true
sudo firewall-cmd --list-all 2>/dev/null || true
echo NGINX_N8N
sudo grep -RIl '5678\|n8n.gsahub.com.br' /etc/nginx /etc/caddy /etc/traefik 2>/dev/null | head -20 || true
echo CLOUDFLARE
ps aux | grep '[c]loudflared' || true
`;

const result = await runSshScript(remote, 45000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
