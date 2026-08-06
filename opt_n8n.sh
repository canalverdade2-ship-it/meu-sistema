sudo docker stop n8n
sudo docker rm n8n
sudo docker run -d \
  --name n8n \
  --restart always \
  -p 5678:5678 \
  --network evo-net \
  -v n8n_data:/home/node/.n8n \
  -e N8N_HOST=163.176.97.152 \
  -e N8N_WEBHOOK_URL=http://163.176.97.152:5678 \
  -e N8N_SECURE_COOKIE=false \
  -e DB_TYPE=postgresdb \
  -e DB_POSTGRESDB_HOST=evo-postgres \
  -e DB_POSTGRESDB_PORT=5432 \
  -e DB_POSTGRESDB_DATABASE=n8n \
  -e DB_POSTGRESDB_USER=evo \
  -e DB_POSTGRESDB_PASSWORD=evopass \
  -e GENERIC_TIMEZONE=America/Sao_Paulo \
  -e TZ=America/Sao_Paulo \
  -e N8N_RUNNERS_ENABLED=false \
  -e N8N_COMMUNITY_PACKAGES_ENABLED=true \
  docker.n8n.io/n8nio/n8n:latest
