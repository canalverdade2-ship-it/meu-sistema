import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
compose=/home/opc/gsa-hub/docker-compose.yml
image_id=$(docker inspect -f '{{.Image}}' n8n)
docker image tag "$image_id" docker.n8n.io/n8nio/n8n:2.33.5
sudo cp -a /etc/gsa/n8n.env /etc/gsa/n8n.env.pre-compose
sudo sed -i '/^N8N_RUNNERS_ENABLED=/d;/^N8N_COMMUNITY_PACKAGES_ENABLED=/d;/^N8N_UNVERIFIED_PACKAGES_ENABLED=/d;/^N8N_RUNNERS_TASK_TIMEOUT=/d' /etc/gsa/n8n.env
printf '%s\n' 'N8N_COMMUNITY_PACKAGES_ENABLED=false' 'N8N_UNVERIFIED_PACKAGES_ENABLED=false' 'N8N_RUNNERS_TASK_TIMEOUT=300' | sudo tee -a /etc/gsa/n8n.env >/dev/null
sudo chmod 0600 /etc/gsa/n8n.env
sudo docker compose -f "$compose" config --quiet
docker stop n8n >/dev/null
docker rm n8n >/dev/null
if ! sudo docker compose -f "$compose" up -d; then
  sudo cp -a /etc/gsa/n8n.env.pre-compose /etc/gsa/n8n.env
  exit 1
fi
ok=0
for i in $(seq 1 45); do if curl -fsS http://127.0.0.1:5678/healthz >/dev/null 2>&1; then ok=1; break; fi; sleep 2; done
test "$ok" = 1
project=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' n8n)
service=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.service"}}' n8n)
port=$(docker inspect -f '{{(index (index .HostConfig.PortBindings "5678/tcp") 0).HostIp}}:{{(index (index .HostConfig.PortBindings "5678/tcp") 0).HostPort}}' n8n)
ip=$(docker inspect -f '{{(index .NetworkSettings.Networks "gsa-tv-automation-net").IPAddress}}' n8n)
workflows=$(docker exec n8n n8n list:workflow 2>/dev/null | grep -c '|' || true)
echo "compose_runtime=ok|project=$project|service=$service|port=$port|automation_ip=$ip|workflows=$workflows"
` , 180000);
process.stdout.write(r.stdout);process.stderr.write(r.stderr);