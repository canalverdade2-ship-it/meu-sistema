import { runSshScript } from './ssh2-run.mjs';
const host='n8n.147-15-43-141.nip.io';
const r=await runSshScript(`set -euo pipefail
stamp=$(date -u +%Y%m%dT%H%M%SZ); old=n8n-pre-hardening-$stamp
image=$(docker inspect -f '{{.Image}}' n8n)
docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' n8n > /tmp/n8n-current.env
grep -Ev '^(N8N_HOST|N8N_WEBHOOK_URL|N8N_PROTOCOL|N8N_SECURE_COOKIE|N8N_PROXY_HOPS|N8N_EDITOR_BASE_URL)=' /tmp/n8n-current.env > /tmp/n8n-hardened.env
cat >> /tmp/n8n-hardened.env <<'ENV'
N8N_HOST=${host}
N8N_WEBHOOK_URL=https://${host}/
N8N_EDITOR_BASE_URL=https://${host}/
N8N_PROTOCOL=https
N8N_SECURE_COOKIE=true
N8N_PROXY_HOPS=1
ENV
chmod 0600 /tmp/n8n-hardened.env
docker stop n8n >/dev/null
docker rename n8n "$old"
docker network disconnect gsa-tv-automation-net "$old" 2>/dev/null || true
docker network disconnect gsa-network "$old" 2>/dev/null || true
rollback(){
  echo 'rollback=starting' >&2
  docker rm -f n8n >/dev/null 2>&1 || true
  docker network connect gsa-network "$old" 2>/dev/null || true
  docker network connect --ip 172.30.250.2 gsa-tv-automation-net "$old" 2>/dev/null || true
  docker rename "$old" n8n
  docker start n8n >/dev/null
  echo 'rollback=restored' >&2
}
trap 'rollback' ERR
id=$(docker run -d --name n8n --restart unless-stopped --network gsa-network --env-file /tmp/n8n-hardened.env -p 127.0.0.1:5678:5678 -v n8n_data:/home/node/.n8n "$image")
docker network connect --ip 172.30.250.2 gsa-tv-automation-net n8n
ok=0
for i in $(seq 1 45); do if curl -fsS http://127.0.0.1:5678/healthz >/dev/null 2>&1; then ok=1; break; fi; sleep 2; done
if [ "$ok" != 1 ]; then docker logs --tail 80 n8n >&2 || true; false; fi
trap - ERR
count=$(docker exec n8n n8n list:workflow 2>/dev/null | grep -c '|' || true)
gsa=$(docker exec n8n n8n list:workflow 2>/dev/null | grep -c '|GSA TV ' || true)
port=$(docker inspect -f '{{(index (index .HostConfig.PortBindings "5678/tcp") 0).HostIp}}:{{(index (index .HostConfig.PortBindings "5678/tcp") 0).HostPort}}' n8n)
ip=$(docker inspect -f '{{(index .NetworkSettings.Networks "gsa-tv-automation-net").IPAddress}}' n8n)
echo "hardened=ok|old=$old|workflows=$count|gsa=$gsa|port=$port|automation_ip=$ip"
rm -f /tmp/n8n-current.env /tmp/n8n-hardened.env
`, 180000);
process.stdout.write(r.stdout);process.stderr.write(r.stderr);