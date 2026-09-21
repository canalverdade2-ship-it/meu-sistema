import { runSshScript } from './ssh2-run.mjs';
const script=`set -euo pipefail
echo '=== compose-labels ==='
docker inspect -f 'project={{index .Config.Labels "com.docker.compose.project"}}|service={{index .Config.Labels "com.docker.compose.service"}}|workdir={{index .Config.Labels "com.docker.compose.project.working_dir"}}|files={{index .Config.Labels "com.docker.compose.project.config_files"}}' n8n
echo '=== public-env ==='
docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' n8n | grep -E '^(N8N_HOST|N8N_PROTOCOL|N8N_PORT|WEBHOOK_URL|N8N_WEBHOOK_URL|N8N_EDITOR_BASE_URL)=' || true
echo '=== published-ports ==='
docker port n8n || true
echo '=== listeners ==='
ss -ltn | awk 'NR==1 || $4 ~ /:(80|443|5678)$/'
echo '=== web-proxy-containers ==='
docker ps --format '{{.Names}}|{{.Image}}|{{.Ports}}' | grep -Ei 'nginx|traefik|caddy|haproxy|apache|:80->|:443->' || true
echo '=== firewall ==='
sudo firewall-cmd --list-ports 2>/dev/null || true
`;
const r=await runSshScript(script,90000);process.stdout.write(r.stdout);process.stderr.write(r.stderr);
