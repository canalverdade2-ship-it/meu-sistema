import { runSshScript } from './ssh2-run.mjs';

const remote = String.raw`set -euo pipefail
for i in $(seq 1 40); do
  state=$(sudo docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{end}}' gsa-tv-control-plane)
  [ "$state" = healthy ] && break
  sleep 2
done
dburl=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print}')
job_id=$(sudo docker run --rm -i --network host postgres:15-alpine psql "$dburl" -X -At -v ON_ERROR_STOP=1 -c "insert into public.gsa_tv_jobs(channel_id,job_type,status,progress,payload) values('ch-main','playout_reset','pending',0,'{\"verification\":\"live_console_1.6.11\"}'::jsonb) returning id")
for i in $(seq 1 30); do
  status=$(sudo docker run --rm -i --network host postgres:15-alpine psql "$dburl" -X -At -c "select status from public.gsa_tv_jobs where id='$job_id'")
  case "$status" in completed|failed) break;; esac
  sleep 2
done
sudo docker run --rm -i --network host postgres:15-alpine psql "$dburl" -X -v ON_ERROR_STOP=1 <<SQL
select id,job_type,status,error_message,result from public.gsa_tv_jobs where id='$job_id';
select desired_state,playout_state,signal_state,last_signal_at,last_heartbeat_at from public.gsa_tv_channels where id='ch-main';
select position('playout_next' in pg_get_functiondef('public.gsa_admin_gsa_tv_live_command(uuid,text,text,jsonb)'::regprocedure))>0 as rpc_commands_ok;
SQL
curl -fsS http://127.0.0.1:9202/health
echo
sudo docker inspect --format 'container={{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}|image={{.Config.Image}}' gsa-tv-control-plane
sudo docker ps --format '{{.Names}}|{{.Status}}' | grep -E '^gsa-tv-(ffplayout|watchdog|control-plane)' | sort
sudo docker logs --tail 25 gsa-tv-control-plane 2>&1
`;
const result = await runSshScript(remote, 150000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
