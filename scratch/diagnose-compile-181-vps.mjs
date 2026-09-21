import { runSshScript } from './ssh2-run.mjs';
const result = await runSshScript(`set -u
DB_URL=$(sudo awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}' /opt/gsa-tv/control-plane/.env)
psql "$DB_URL" -X -P pager=off -c "select id,status,error_message,result,created_at,finished_at from public.gsa_tv_jobs where job_type='compile_playlist' order by created_at desc limit 3"
sudo docker logs --since 5m gsa-tv-control-plane 2>&1 | tail -n 240
echo 'engine:'; curl -fsS http://127.0.0.1:9210/health; echo
`,180000);
process.stdout.write(result.stdout); if(result.stderr) process.stderr.write(result.stderr);
