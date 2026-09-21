import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -u
DBURL=$(sudo docker inspect gsa-tv-encoder-engine --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
sudo docker run --rm -i --network host postgres:15-alpine psql -X -v ON_ERROR_STOP=1 -P pager=off -At "$DBURL" <<'SQL'
select '=== BACKUP HISTORY ===';
select id||'|'||state||'|'||started_at||'|'||coalesce(finished_at::text,'')||'|size='||coalesce(size_bytes::text,'') from public.gsa_tv_backup_runs order by started_at desc limit 20;

select '=== RLS COVERAGE ===';
select 'rls_disabled|'||relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and relkind='r' and relname like 'gsa_tv_%' and not relrowsecurity order by relname;
select 'no_policy|'||c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace left join pg_policy p on p.polrelid=c.oid where n.nspname='public' and c.relkind='r' and c.relname like 'gsa_tv_%' and c.relrowsecurity group by c.relname having count(p.oid)=0 order by c.relname;
select 'broad_grant|'||table_name||'|'||grantee||'|'||privilege_type from information_schema.role_table_grants where table_schema='public' and table_name like 'gsa_tv_%' and grantee in ('anon','authenticated','PUBLIC') and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER') order by table_name,grantee,privilege_type;
select 'secret_rls|'||c.relname||'|'||c.relrowsecurity||'|force='||c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('gsa_tv_channel_secrets','gsa_tv_live_source_secrets','gsa_tv_ai_provider_secrets','gsa_tv_ai_provider_credentials');

select '=== DEFINER FUNCTIONS WITHOUT FIXED SEARCH PATH ===';
select 'definer_unfixed|'||n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and not exists(select 1 from unnest(coalesce(p.proconfig,array[]::text[])) x where x like 'search_path=%') and p.proname like '%gsa%tv%' order by p.proname;

select '=== PROGRAM/SCHEDULE COLUMNS ===';
select table_name||'|'||string_agg(column_name,',' order by ordinal_position) from information_schema.columns where table_schema='public' and table_name in ('gsa_tv_programs','gsa_tv_program_blocks','gsa_tv_weekly_grid_slots','gsa_tv_media_items','gsa_tv_ai_presenters','gsa_tv_virtual_presenters') group by table_name order by table_name;

select '=== PROGRAM BASIC INTEGRITY ===';
select 'programs_total|'||count(*) from public.gsa_tv_programs;
select 'duplicate_program_name|'||lower(trim(name))||'|'||count(*) from public.gsa_tv_programs group by lower(trim(name)) having count(*)>1 order by count(*) desc;
select 'media_state|'||state||'|'||count(*) from public.gsa_tv_media_items group by state order by state;
select 'media_ready_missing_path|'||count(*) from public.gsa_tv_media_items where state='ready' and coalesce(drive_path,'')='';
select 'grid_count_by_day|'||weekday||'|'||count(*) from public.gsa_tv_weekly_grid_slots group by weekday order by weekday;
select 'grid_duplicate_start|'||weekday||'|'||start_time||'|'||count(*) from public.gsa_tv_weekly_grid_slots group by weekday,start_time having count(*)>1 order by weekday,start_time;
select 'schedule_version_state|'||state||'|'||count(*)||'|latest='||max(broadcast_date) from public.gsa_tv_schedule_versions group by state order by state;
SQL
`,240000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
