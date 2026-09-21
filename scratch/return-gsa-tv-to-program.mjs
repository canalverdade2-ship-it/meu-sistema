import { runSshScript } from './ssh2-run.mjs';

const script = String.raw`set -euo pipefail
dburl=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
job_id=$(sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -qAt -c "
insert into public.gsa_tv_jobs(channel_id,job_type,status,progress,payload)
values('ch-main','live_return','pending',0,jsonb_build_object('source','operator_rejected_static_presenters','authorized_by','Adriano Farias'))
returning id;")
echo "return_job|$job_id"
for i in $(seq 1 30); do
  row=$(sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -F '|' -c "select status,coalesce(error_message,'') from public.gsa_tv_jobs where id='$job_id';")
  case "$row" in completed'|'*) break ;; failed'|'*) echo "$row"; exit 1 ;; esac
  sleep 1
done
echo "return_result|$row"
sleep 5
sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -F '|' -c "
select 'channel',status,desired_state,playout_state,signal_state,coalesce(last_error,'') from public.gsa_tv_channels where id='ch-main';"
`;

const result = await runSshScript(script, 60000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
