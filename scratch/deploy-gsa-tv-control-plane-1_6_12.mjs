import fs from 'node:fs';
import { runSshScript } from './ssh2-run.mjs';

const files = {
  Dockerfile: fs.readFileSync(new URL('../infrastructure/gsa-tv/services/playout-api/Dockerfile', import.meta.url), 'utf8'),
  'package.json': fs.readFileSync(new URL('../infrastructure/gsa-tv/services/playout-api/package.json', import.meta.url), 'utf8'),
  'src/app.js': fs.readFileSync(new URL('../infrastructure/gsa-tv/services/playout-api/src/app.js', import.meta.url), 'utf8'),
  'src/gemini.js': fs.readFileSync(new URL('../infrastructure/gsa-tv/services/playout-api/src/gemini.js', import.meta.url), 'utf8'),
};
const compose = `services:
  control-plane:
    build: .
    image: gsa-tv/control-plane:1.6.12
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
files['compose.yml'] = compose;
const payload = Buffer.from(JSON.stringify(files)).toString('base64');
const remote = String.raw`set -euo pipefail
base=/opt/gsa-tv/control-plane
work=/tmp/gsa-tv-control-plane-1_6_12
active=$(sudo docker inspect --format '{{.Config.Image}}|{{.State.Status}}' gsa-tv-control-plane)
test "$active" = 'gsa-tv/control-plane:1.6.11|running'
rm -rf "$work" && mkdir -p "$work/src"
printf '%s' '${payload}' | base64 -d | python3 -c 'import sys,json,os; d=json.load(sys.stdin); b="/tmp/gsa-tv-control-plane-1_6_12"; [(os.makedirs(os.path.dirname(b+"/"+k),exist_ok=True),open(b+"/"+k,"w",encoding="utf-8").write(v)) for k,v in d.items()]'
sudo docker build --pull -t gsa-tv/control-plane:1.6.12 "$work" >/tmp/gsa-tv-build-1.6.12.log
sudo docker run --rm --entrypoint node gsa-tv/control-plane:1.6.12 --check /app/src/app.js
sudo install -m 0644 -o root -g root "$work/Dockerfile" "$base/Dockerfile"
sudo install -m 0644 -o root -g root "$work/package.json" "$base/package.json"
sudo install -m 0644 -o root -g root "$work/src/app.js" "$base/src/app.js"
sudo install -m 0644 -o root -g root "$work/src/gemini.js" "$base/src/gemini.js"
sudo install -m 0644 -o root -g root "$work/compose.yml" "$base/compose.yml"
sudo docker stop -t 15 gsa-tv-control-plane >/dev/null
sudo docker rm gsa-tv-control-plane >/dev/null
sudo docker compose -p control-plane --project-directory "$base" -f "$base/compose.yml" up -d >/tmp/gsa-tv-up-1.6.12.log
for i in $(seq 1 45); do
  if curl -fsS http://127.0.0.1:9202/health >/tmp/gsa-tv-health-1.6.12.json 2>/dev/null; then break; fi
  sleep 2
done
cat /tmp/gsa-tv-health-1.6.12.json
echo
sudo docker inspect --format 'container={{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}|image={{.Config.Image}}' gsa-tv-control-plane
sudo docker exec gsa-tv-control-plane sh -lc "grep -q 'live-console/snapshot' /app/src/app.js && grep -q 'media-preview' /app/src/app.js && grep -q \"preset === \\\"breaking\\\"\" /app/src/app.js && echo final_console_markers=ok"
curl -sS -o /tmp/gsa-tv-snapshot-unauth.json -w 'snapshot_unauth_http=%{http_code}\n' http://127.0.0.1:9202/live-console/snapshot
cat /tmp/gsa-tv-snapshot-unauth.json
`;
const result = await runSshScript(remote, 300000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
