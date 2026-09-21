import { runSshScript } from './ssh2-run.mjs';
const compose=`name: gsa-n8n-runtime
services:
  n8n:
    image: docker.n8n.io/n8nio/n8n:2.33.5
    container_name: n8n
    restart: unless-stopped
    env_file:
      - /etc/gsa/n8n.env
    ports:
      - "127.0.0.1:5678:5678"
    volumes:
      - n8n_data:/home/node/.n8n
    networks:
      gsa-network: {}
      gsa-tv-automation-net:
        ipv4_address: 172.30.250.2
volumes:
  n8n_data:
    external: true
networks:
  gsa-network:
    external: true
  gsa-tv-automation-net:
    external: true
`;
const b64=Buffer.from(compose).toString('base64');
const r=await runSshScript(`set -euo pipefail
stamp=$(date -u +%Y%m%dT%H%M%SZ)
sudo install -d -m 0700 /etc/gsa /root/gsa-legacy-archive
sudo cp -a /home/opc/gsa-hub/docker-compose.yml /root/gsa-legacy-archive/docker-compose-$stamp.yml
sudo chmod 0600 /root/gsa-legacy-archive/docker-compose-$stamp.yml
docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' n8n >/tmp/n8n-all.env
python3 - <<'PY' >/tmp/n8n.env
allow={'DB_TYPE','DB_POSTGRESDB_HOST','DB_POSTGRESDB_PORT','DB_POSTGRESDB_DATABASE','DB_POSTGRESDB_USER','DB_POSTGRESDB_PASSWORD','N8N_COMMUNITY_PACKAGES_ENABLED','N8N_RELEASE_TYPE','N8N_RUNNERS_ENABLED','N8N_HOST','N8N_WEBHOOK_URL','N8N_EDITOR_BASE_URL','N8N_PROTOCOL','N8N_SECURE_COOKIE','N8N_PROXY_HOPS','NODE_ENV'}
for line in open('/tmp/n8n-all.env'):
 k=line.split('=',1)[0]
 if k in allow: print(line.rstrip())
PY
sudo install -m 0600 /tmp/n8n.env /etc/gsa/n8n.env
printf '%s' '${b64}' | base64 -d >/tmp/docker-compose.yml
sudo install -o opc -g opc -m 0644 /tmp/docker-compose.yml /home/opc/gsa-hub/docker-compose.yml
sudo docker compose -f /home/opc/gsa-hub/docker-compose.yml config --quiet
echo "compose=ok|env_mode=$(stat -c %a /etc/gsa/n8n.env)|archive=ok"
rm -f /tmp/n8n-all.env /tmp/n8n.env /tmp/docker-compose.yml
`);
process.stdout.write(r.stdout);process.stderr.write(r.stderr);