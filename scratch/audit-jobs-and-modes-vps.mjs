import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -u
APP=/opt/gsa-tv/control-plane/src/app.js
echo '=== process jobs ==='
sed -n '4250,4465p' "$APP"
echo '=== scheduled automation calls ==='
grep -nE 'scheduledLiveAutomation|startStream\(|stopStream\(' "$APP" | tail -n 200
echo '=== control tables ==='
DBURL=$(sudo docker inspect gsa-tv-encoder-engine --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
echo "select table_name from information_schema.tables where table_schema='public' and table_name like 'gsa_tv_%' and (table_name ilike '%job%' or table_name ilike '%command%' or table_name ilike '%event%') order by 1;" | sudo docker run --rm -i --network host postgres:15-alpine psql -At "$DBURL"
echo '=== channel persisted vs engine ==='
echo "select id,desired_state,playout_state,signal_state,status,last_error,last_heartbeat_at,last_signal_at from public.gsa_tv_channels where id='ch-main';" | sudo docker run --rm -i --network host postgres:15-alpine psql -At "$DBURL"
curl -fsS http://127.0.0.1:9210/health; echo
`,180000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
