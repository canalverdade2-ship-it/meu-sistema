import { runSshScript } from './ssh2-run.mjs';

const remote = String.raw`set -euo pipefail
dburl=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print}')
sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -v ON_ERROR_STOP=1 -At -F '|' -c "update public.gsa_tv_graphics set enabled=false,updated_at=now() where channel_id='ch-main' and (name ilike '%teste%' or name ilike '%test%'); select layer_type,name,enabled,coalesce(media_item_id,'') from public.gsa_tv_graphics where channel_id='ch-main' order by created_at;"
sudo docker compose --project-directory /opt/gsa-tv/control-plane -f /opt/gsa-tv/control-plane/compose.yml restart control-plane >/dev/null
for i in $(seq 1 30); do curl -fsS http://127.0.0.1:9202/health >/dev/null 2>&1 && break; sleep 2; done
curl -fsS http://127.0.0.1:9202/health
echo
`;

const result = await runSshScript(remote, 90000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
