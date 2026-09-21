import { runSshScript } from './ssh2-run.mjs';

const compose = `services:
  control-plane:
    build: .
    image: gsa-tv/control-plane:1.6.11
    container_name: gsa-tv-control-plane
    restart: unless-stopped
    network_mode: host
    env_file: .env
    read_only: true
    tmpfs:
      - /tmp:size=64m,mode=1777
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    volumes:
      - /opt/gsa-tv/playlists:/playlists
      - /opt/gsa-tv/cache/media:/media
      - /opt/gsa-tv/fallback:/fallback:ro
      - /opt/gsa-tv/preview:/preview:ro
      - /opt/gsa-tv/control-plane/secrets/ffplayout-admin-password:/run/secrets/ffplayout-admin-password:ro
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://127.0.0.1:9202/health',r=>process.exit(r.statusCode===200?0:1))"]
      interval: 30s
      timeout: 5s
      retries: 3
`;
const compose64 = Buffer.from(compose).toString('base64');
const remote = String.raw`set -euo pipefail
active=$(sudo docker inspect --format '{{.Config.Image}}|{{.State.Status}}' gsa-tv-control-plane)
test "$active" = 'gsa-tv/control-plane:1.6.10|running'
ghost=$(sudo docker ps -aq --filter 'name=9e2f8f569d15_gsa-tv-control-plane')
if [ -n "$ghost" ]; then
  ghost_state=$(sudo docker inspect --format '{{.State.Status}}' "$ghost")
  test "$ghost_state" = 'created'
  sudo docker rm "$ghost" >/dev/null
fi
sudo docker tag gsa-tv/control-plane:1.6.7 gsa-tv/control-plane:1.6.11
printf '%s' '${compose64}' | base64 -d > /tmp/gsa-tv-compose-1.6.11.yml
sudo install -m 0644 -o root -g root /tmp/gsa-tv-compose-1.6.11.yml /opt/gsa-tv/control-plane/compose.yml
current_id=$(sudo docker inspect --format '{{.Id}}' gsa-tv-control-plane)
test "$current_id" = 'b14ce479a84384455da062dbd451a09a4f515044da446e003343d2fbe7df85bf'
sudo docker stop -t 15 gsa-tv-control-plane >/tmp/gsa-tv-1.6.11-stop.log
sudo docker rm gsa-tv-control-plane >/tmp/gsa-tv-1.6.11-remove.log
sudo docker compose -p control-plane --project-directory /opt/gsa-tv/control-plane -f /opt/gsa-tv/control-plane/compose.yml up -d >/tmp/gsa-tv-1.6.11-up.log
for i in $(seq 1 45); do
  if curl -fsS http://127.0.0.1:9202/health >/tmp/gsa-tv-health.json 2>/dev/null; then break; fi
  sleep 2
done
cat /tmp/gsa-tv-health.json
echo
sudo docker inspect --format 'container={{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}|image={{.Config.Image}}' gsa-tv-control-plane
sudo docker exec gsa-tv-control-plane sh -lc "grep -q 'playout_next' /app/src/app.js && grep -q 'media_take' /app/src/app.js && grep -q 'emergency_take' /app/src/app.js && echo live_console_markers=ok"
`;
const result = await runSshScript(remote, 120000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
