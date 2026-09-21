import { runSshScript } from './ssh2-run.mjs';
const script=String.raw`set -euo pipefail
sleep 18
dburl=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
echo '=== channel ==='
sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -F '|' -c "select status,desired_state,playout_state,signal_state,coalesce(last_error,''),last_signal_at from public.gsa_tv_channels where id='ch-main';"
echo '=== watchdog ==='
sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -F '|' -c "select created_at,control_plane_ok,ffplayout_ok,hls_ok,round(hls_age_s::numeric,2),black_detected,silence_detected,freeze_detected,current_title from public.gsa_tv_watchdog_samples where channel_id='ch-main' order by created_at desc limit 3;"
echo '=== as-run ==='
sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -F '|' -c "select title,source,outcome,started_at,coalesce(ended_at::text,'') from public.gsa_tv_execution_log where channel_id='ch-main' order by started_at desc limit 5;"
echo '=== jobs ==='
sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -F '|' -c "select job_type,status,progress,coalesce(error_message,'') from public.gsa_tv_jobs where created_at>now()-interval '10 minutes' order by created_at desc limit 8;"
echo '=== hls ==='
curl -fsS http://127.0.0.1:8787/public/1/live/stream.m3u8 | head -12
`;
const r=await runSshScript(script,90000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
