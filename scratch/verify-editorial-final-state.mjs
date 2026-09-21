import { runSshScript } from './ssh2-run.mjs';
const script=String.raw`set -euo pipefail
sleep 18
echo '=== containers ==='
sudo docker ps --format '{{.Names}}|{{.Image}}|{{.Status}}' | grep -E '^(gsa-tv-|n8n)' || true
dburl=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
echo '=== broadcast ==='
sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -F '|' -c "select 'channel',status,desired_state,playout_state,signal_state,coalesce(last_error,''),quality_profile from public.gsa_tv_channels where id='ch-main'; select 'watchdog',created_at,current_title,black_detected,silence_detected,freeze_detected,(metrics->>'freeze_exempt') from public.gsa_tv_watchdog_samples where channel_id='ch-main' order by created_at desc limit 3; select 'incident_open',count(*) from public.gsa_tv_incidents where channel_id='ch-main' and not resolved; select 'freeze_open',count(*) from public.gsa_tv_incidents where channel_id='ch-main' and not resolved and message='Watchdog: vídeo congelado detectado'; select 'asrun',title,source,outcome,started_at,coalesce(ended_at::text,'') from public.gsa_tv_execution_log where channel_id='ch-main' order by started_at desc limit 3; select 'schedule',broadcast_date,version,state,title from public.gsa_tv_schedule_versions where channel_id='ch-main' and state='published' order by broadcast_date;"
echo '=== n8n workflows ==='
sudo docker exec n8n n8n list:workflow 2>/dev/null | grep -E 'GSA TV|GSA System|GSA HUB' || true
`;
const r=await runSshScript(script,90000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
