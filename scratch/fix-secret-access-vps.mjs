import { runSshScript } from './ssh2-run.mjs';
const result = await runSshScript(`set -Eeuo pipefail
echo 'container identities:'
sudo docker exec gsa-tv-control-plane id
sudo docker exec gsa-tv-watchdog id
CP_UID=$(sudo docker exec gsa-tv-control-plane id -u)
WD_UID=$(sudo docker exec gsa-tv-watchdog id -u)
sudo chown root:"$CP_UID" /opt/gsa-tv/control-plane/secrets/ffplayout-admin-password
sudo chmod 0440 /opt/gsa-tv/control-plane/secrets/ffplayout-admin-password
sudo chown root:"$WD_UID" /opt/gsa-tv/watchdog/secrets/ffplayout-admin-password
sudo chmod 0440 /opt/gsa-tv/watchdog/secrets/ffplayout-admin-password
sudo docker compose -f /opt/gsa-tv/control-plane/compose.yml restart control-plane
for i in $(seq 1 45); do
  sudo docker inspect gsa-tv-control-plane --format '{{.State.Health.Status}}' | grep -qx healthy && break
  sleep 1
done
DB_URL=$(sudo awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}' /opt/gsa-tv/control-plane/.env)
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -c "insert into public.gsa_tv_jobs(channel_id,job_type,status,progress,payload) values('ch-main','compile_playlist','pending',0,'{}'::jsonb)" >/dev/null
for i in $(seq 1 60); do
  state=$(psql "$DB_URL" -X -Atc "select status from public.gsa_tv_jobs where job_type='compile_playlist' order by created_at desc limit 1")
  [[ "$state" =~ ^(completed|failed|cancelled)$ ]] && break
  sleep 1
done
echo "compile_state=$state"
psql "$DB_URL" -X -P pager=off -c "select status,error_message,result from public.gsa_tv_jobs where job_type='compile_playlist' order by created_at desc limit 1"
[[ "$state" == completed ]]
echo 'playlist filler max duration:'
node -e "const p=require('/opt/gsa-tv/playlists/1/'+new Date().toISOString().slice(0,10)+'.json'); const a=p.program.filter(x=>x.source.includes('filler')); console.log(Math.max(...a.map(x=>x.duration)),a.length)"
curl -fsS http://127.0.0.1:9210/health; echo
`, 180000);
process.stdout.write(result.stdout); if(result.stderr) process.stderr.write(result.stderr);
