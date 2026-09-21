import { runSshScript } from './ssh2-run.mjs';
const script=String.raw`set -euo pipefail
dburl=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
echo '=== before ==='
sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -F '|' -c "select status,desired_state,playout_state,signal_state,coalesce(last_error,'') from public.gsa_tv_channels where id='ch-main';"
reload_id=$(sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -qAt -c "insert into public.gsa_tv_jobs(channel_id,job_type,status,progress,payload) values('ch-main','playout_reload','pending',0,'{\"source\":\"editorial-ep01-after-168\"}'::jsonb) returning id;")
echo "reload_id=$reload_id"
for i in 1 2 3 4 5 6 7 8 9 10 11 12; do state=$(sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -qAt -c "select status from public.gsa_tv_jobs where id='$reload_id'"); echo "reload_state=$state"; [ "$state" = completed ] && break; [ "$state" = failed ] && break; sleep 3; done
sleep 18
echo '=== after ==='
sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -F '|' -c "select 'job',job_type,status,progress,coalesce(error_message,''),coalesce(result::text,'') from public.gsa_tv_jobs where id='$reload_id'; select 'channel',status,desired_state,playout_state,signal_state,coalesce(last_error,''),last_signal_at from public.gsa_tv_channels where id='ch-main'; select 'watchdog',created_at,current_title,control_plane_ok,ffplayout_ok,hls_ok,black_detected,silence_detected,freeze_detected from public.gsa_tv_watchdog_samples where channel_id='ch-main' order by created_at desc limit 4; select 'asrun',title,source,outcome,started_at,coalesce(ended_at::text,'') from public.gsa_tv_execution_log where channel_id='ch-main' order by started_at desc limit 4;"
`;
const r=await runSshScript(script,120000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
