import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -u
DBURL=$(sudo docker inspect gsa-tv-encoder-engine --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
echo "select job_type,status,count(*) from public.gsa_tv_jobs where created_at>now()-interval '7 days' group by job_type,status order by job_type,status;" | sudo docker run --rm -i --network host postgres:15-alpine psql -At "$DBURL"
echo '=== recent failed ==='
echo "select created_at,job_type,status,left(coalesce(error_message,''),300) from public.gsa_tv_jobs where status='failed' and created_at>now()-interval '7 days' order by created_at desc limit 50;" | sudo docker run --rm -i --network host postgres:15-alpine psql -At "$DBURL"
echo '=== stale running ==='
echo "select id,job_type,status,created_at,started_at from public.gsa_tv_jobs where status='running' and started_at<now()-interval '5 minutes';" | sudo docker run --rm -i --network host postgres:15-alpine psql -At "$DBURL"
echo '=== scheduled function context ==='
grep -n -F 'scheduledLiveAutomation' /opt/gsa-tv/control-plane/src/app.js
`,120000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
