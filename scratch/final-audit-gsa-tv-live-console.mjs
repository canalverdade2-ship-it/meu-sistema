import { runSshScript } from './ssh2-run.mjs';

const result = await runSshScript(String.raw`set -euo pipefail
dburl=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print}')
sudo docker run --rm -i --network host postgres:15-alpine psql "$dburl" -X -v ON_ERROR_STOP=1 <<'SQL'
select job_type,status,error_message,result from public.gsa_tv_jobs where job_type='playout_reset' order by created_at desc limit 1;
select desired_state,playout_state,signal_state,last_signal_at,last_heartbeat_at from public.gsa_tv_channels where id='ch-main';
select position('playout_next' in pg_get_functiondef('public.gsa_admin_gsa_tv_live_command(uuid,text,text,jsonb)'::regprocedure))>0 as rpc_commands_ok;
select current_title,hls_ok,black_detected,silence_detected,freeze_detected,created_at from public.gsa_tv_watchdog_samples order by created_at desc limit 1;
SQL
curl -fsS http://127.0.0.1:9202/health
echo
sudo docker inspect --format 'container={{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}|image={{.Config.Image}}' gsa-tv-control-plane
sudo docker ps --format '{{.Names}}|{{.Status}}' | grep -E '^gsa-tv-(ffplayout|watchdog|control-plane)' | sort
`, 60000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
