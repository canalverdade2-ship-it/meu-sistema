import { runSshScript } from './ssh2-run.mjs';
const script=String.raw`set -euo pipefail
dburl=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}'|awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -v ON_ERROR_STOP=1 -c "update public.gsa_tv_graphics set enabled=false,updated_at=now() where id in ('9f1d56ce-68f6-4f9c-8b91-c17c5f49d302','cbb0f824-87ba-45f7-a8b5-8f3d65268f3c','7bc9f31c-e50b-421c-896d-545a9cf3aa42','3b1cc764-fbaa-428a-b398-7cdf61c34120');"
job_id=$(sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -qAt -c "insert into public.gsa_tv_jobs(channel_id,job_type,status,progress,payload) values('ch-main','graphics_reload','pending',0,'{\"source\":\"remove_rejected_stacked_tickers\"}'::jsonb) returning id;")
for i in $(seq 1 35);do row=$(sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -F '|' -c "select status,coalesce(error_message,'') from public.gsa_tv_jobs where id='$job_id';");case "$row" in completed'|'*)break;;failed'|'*)echo "$row";exit 1;;esac;sleep 1;done
sleep 5
sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -F '|' -c "select quality_profile,status,desired_state,playout_state,signal_state,coalesce(last_error,'') from public.gsa_tv_channels where id='ch-main';select name,enabled from public.gsa_tv_graphics where id in ('9f1d56ce-68f6-4f9c-8b91-c17c5f49d302','cbb0f824-87ba-45f7-a8b5-8f3d65268f3c','7bc9f31c-e50b-421c-896d-545a9cf3aa42','3b1cc764-fbaa-428a-b398-7cdf61c34120');"
`;
const result=await runSshScript(script,60000);process.stdout.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);
