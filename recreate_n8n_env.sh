#!/bin/bash
set -e

echo "=== Parando o container N8N atual ==="
sudo docker stop n8n
sudo docker rename n8n n8n-old2

echo "=== Criando novo container N8N com permissões para require ==="
sudo docker run -d \
  --name n8n \
  --restart always \
  --network gsa-network \
  -p 0.0.0.0:5678:5678 \
  -v n8n_data:/home/node/.n8n \
  -e DB_TYPE=postgresdb \
  -e DB_POSTGRESDB_HOST=evo-postgres \
  -e DB_POSTGRESDB_PORT=5432 \
  -e DB_POSTGRESDB_DATABASE=n8n \
  -e DB_POSTGRESDB_USER=evo \
  -e DB_POSTGRESDB_PASSWORD=evopass \
  -e N8N_RUNNERS_ENABLED=false \
  -e N8N_COMMUNITY_PACKAGES_ENABLED=true \
  -e N8N_HOST=n8n.147-15-43-141.nip.io \
  -e N8N_WEBHOOK_URL=https://n8n.147-15-43-141.nip.io/ \
  -e N8N_EDITOR_BASE_URL=https://n8n.147-15-43-141.nip.io/ \
  -e N8N_PROTOCOL=https \
  -e N8N_SECURE_COOKIE=true \
  -e N8N_PROXY_HOPS=1 \
  -e NODE_FUNCTION_ALLOW_BUILTIN=* \
  -e NODE_FUNCTION_ALLOW_EXTERNAL=* \
  docker.n8n.io/n8nio/n8n:latest

echo "=== Removendo container antigo ==="
sudo docker rm n8n-old2

echo "=== DONE ==="