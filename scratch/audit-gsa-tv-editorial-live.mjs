import { runSshScript } from './ssh2-run.mjs';

const remote = String.raw`set -euo pipefail
dburl=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print}')
sudo docker run --rm -i --network host postgres:15-alpine psql "$dburl" -X -v ON_ERROR_STOP=1 <<'SQL'
select id,job_type,status,error_message,created_at,started_at,finished_at from public.gsa_tv_jobs where id in ('7b57f2a5-b19a-46cd-8f72-8916a9a667aa','bac75b0d-d80f-445d-9dbf-9f8996f88342') order by created_at;
select broadcast_date,state,count(*) versions from public.gsa_tv_schedule_versions where channel_id='ch-main' and broadcast_date between current_date and current_date+1 group by broadcast_date,state order by broadcast_date,state;
select status,license_type,territory,platforms,justification from public.gsa_tv_rights_records where media_item_id='media-gsa-hub-editorial-ep01';
select count(*) comments from public.gsa_tv_comments where resource_type='schedule_version' and body like 'Grade editorial inaugural%';
SQL
echo '--- containers ---'
sudo docker ps --format '{{.Names}}|{{.Status}}' | grep '^gsa-tv-' | sort
echo '--- health ---'
curl -fsS http://127.0.0.1:9202/health
echo
echo '--- playlists ---'
sudo grep -R -m 3 -n 'gsa-hub-editorial-ep01' /opt/gsa-tv/playlists 2>/dev/null || true
echo '--- ffplayout logs ---'
sudo docker logs --tail 40 gsa-tv-ffplayout 2>&1 | tail -40
echo '--- watchdog ---'
curl -fsS http://127.0.0.1:9201/health || true
echo
`;
const result = await runSshScript(remote, 120000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
