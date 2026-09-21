import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -u
DBURL=$(sudo docker inspect gsa-tv-encoder-engine --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
sudo docker run --rm -i --network host postgres:15-alpine psql -X -v ON_ERROR_STOP=1 -P pager=off -At "$DBURL" <<'SQL'
select '=== DB VERSION/CAPACITY ===';
select version();
select 'db_size|'||pg_size_pretty(pg_database_size(current_database()));
select 'connections|'||count(*)||'/'||(select setting from pg_settings where name='max_connections') from pg_stat_activity;
select 'activity|'||coalesce(state,'null')||'|'||count(*)||'|oldest_s='||round(extract(epoch from(now()-min(coalesce(xact_start,query_start,backend_start))))::numeric,1) from pg_stat_activity group by state order by count(*) desc;
select 'waiting_lock|'||count(*) from pg_stat_activity where wait_event_type='Lock';
select 'long_tx|'||pid||'|'||usename||'|'||coalesce(state,'')||'|'||round(extract(epoch from(now()-xact_start))::numeric,1) from pg_stat_activity where xact_start is not null and now()-xact_start>interval '60 seconds' order by xact_start;

select '=== GSA TABLE INVENTORY ===';
select table_name from information_schema.tables where table_schema='public' and table_name like 'gsa_tv_%' order by table_name;
select '=== TOP GSA TABLE SIZES ===';
select relname||'|'||pg_size_pretty(pg_total_relation_size(relid))||'|live='||n_live_tup||'|dead='||n_dead_tup||'|last_auto='||coalesce(last_autovacuum::text,'') from pg_stat_user_tables where relname like 'gsa_tv_%' order by pg_total_relation_size(relid) desc limit 30;

select '=== CHANNEL ===';
select id||'|'||status||'|'||desired_state||'|'||playout_state||'|'||signal_state||'|heartbeat_age_s='||round(extract(epoch from(now()-last_heartbeat_at))::numeric,1)||'|signal_age_s='||round(extract(epoch from(now()-last_signal_at))::numeric,1)||'|error='||coalesce(last_error,'') from public.gsa_tv_channels;

select '=== JOB QUEUE ===';
select status||'|'||count(*)||'|oldest='||min(created_at)||'|newest='||max(created_at) from public.gsa_tv_jobs group by status order by status;
select 'stale|'||id||'|'||job_type||'|'||status||'|age_s='||round(extract(epoch from(now()-created_at))::numeric,1) from public.gsa_tv_jobs where status in ('running','queued','pending') and created_at<now()-interval '10 minutes' order by created_at limit 100;
select 'concurrent_type|'||job_type||'|'||count(*) from public.gsa_tv_jobs where status in ('running','queued','pending') group by job_type having count(*)>1 order by count(*) desc;
select 'fail_7d|'||job_type||'|'||count(*) from public.gsa_tv_jobs where status='failed' and created_at>now()-interval '7 days' group by job_type order by count(*) desc;

select '=== INCIDENTS/WATCHDOG ===';
select 'open_incidents|'||severity||'|'||count(*)||'|oldest='||min(created_at) from public.gsa_tv_incidents where not resolved group by severity order by severity;
select 'watch_latest|'||control_plane_ok||'|'||ffplayout_ok||'|'||hls_ok||'|hls_age='||coalesce(hls_age_s::text,'')||'|signal='||signal_state||'|black='||black_detected||'|silence='||silence_detected||'|freeze='||freeze_detected||'|at='||created_at from public.gsa_tv_watchdog_samples order by created_at desc limit 10;

select '=== BACKUP RUNS COLUMNS ===';
select string_agg(column_name,',' order by ordinal_position) from information_schema.columns where table_schema='public' and table_name='gsa_tv_backup_runs';

select '=== SCHEDULE TABLE COLUMNS ===';
select table_name||'|'||string_agg(column_name,',' order by ordinal_position) from information_schema.columns where table_schema='public' and table_name like 'gsa_tv_%schedule%' group by table_name order by table_name;
select '=== DUPLICATE INDEX DEFINITIONS ===';
with x as (select tablename,indexdef,count(*) over(partition by tablename,regexp_replace(indexdef,'INDEX [^ ]+','INDEX')) n from pg_indexes where schemaname='public' and tablename like 'gsa_tv_%') select tablename||'|'||n||'|'||indexdef from x where n>1 order by tablename,indexdef;
SQL
`,240000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
