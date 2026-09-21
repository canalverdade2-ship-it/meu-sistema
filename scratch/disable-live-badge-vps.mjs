import { runSshScript } from './ssh2-run.mjs';

const result = await runSshScript(`set -eu
DB_URL=$(sudo awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}' /opt/gsa-tv/control-plane/.env)
echo '=== TRACE ==='
psql "$DB_URL" -X -P pager=off -c "select row_to_json(a) from (select * from public.gsa_tv_audit_log where created_at >= timestamp with time zone '2026-09-06 03:50:00+00' order by created_at desc limit 40) a"
echo '=== DISABLE PERSISTED BADGE ==='
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -P pager=off <<'SQL'
begin;
update public.gsa_tv_graphics
set enabled=false, updated_at=now()
where id='70faed0c-f6b5-4b01-b80f-493bdbda6708'
  and config->>'preset'='live_badge';
insert into public.gsa_tv_jobs(channel_id,job_type,status,progress,payload)
select 'ch-main','graphics_reload','pending',0,'{}'::jsonb
where not exists (
  select 1 from public.gsa_tv_jobs
  where channel_id='ch-main' and job_type='graphics_reload' and status in ('pending','running')
);
commit;
SQL
for i in $(seq 1 30); do
  STATUS=$(psql "$DB_URL" -X -Atc "select status from public.gsa_tv_jobs where channel_id='ch-main' and job_type='graphics_reload' order by created_at desc limit 1")
  [ "$STATUS" = completed ] && break
  [ "$STATUS" = failed ] && break
  sleep 1
done
echo '=== RESULT ==='
psql "$DB_URL" -X -P pager=off -c "select id,name,enabled,config,updated_at from public.gsa_tv_graphics where id='70faed0c-f6b5-4b01-b80f-493bdbda6708'"
psql "$DB_URL" -X -P pager=off -c "select id,job_type,status,error_message,created_at,finished_at from public.gsa_tv_jobs where channel_id='ch-main' and job_type='graphics_reload' order by created_at desc limit 3"
curl -fsS http://127.0.0.1:9210/health; echo
echo '=== PUBLISHERS ==='
sudo ps -eo pid,ppid,args | grep -E '[f]fmpeg.*(rtmp|RTMP)' | sed -E 's#(rtmps?://)[^ ]+#\\1[REDACTED]#g'
`, 120000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
