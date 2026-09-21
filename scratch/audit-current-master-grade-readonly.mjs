import { runSshScript } from './ssh2-run.mjs';

const sql = String.raw`
BEGIN TRANSACTION READ ONLY;

select 'column', table_name, ordinal_position, column_name, data_type
from information_schema.columns
where table_schema='public'
  and table_name in ('gsa_tv_programs','gsa_tv_schedule_versions','gsa_tv_program_blocks','gsa_tv_schedule_slots')
order by table_name, ordinal_position;

select 'schedule_version', id, broadcast_date, version, state, title,
       coalesce(published_at::text,''), coalesce(updated_at::text,'')
from public.gsa_tv_schedule_versions
where channel_id='ch-main'
order by broadcast_date desc, version desc
limit 40;

select 'program_status', status, count(*)
from public.gsa_tv_programs
where channel_id='ch-main'
group by status
order by status;

select 'fixed_day', v.broadcast_date, count(*) as blocks,
       sum(b.planned_duration_s) as duration_s,
       count(distinct b.program_id) as distinct_programs
from public.gsa_tv_schedule_versions v
join public.gsa_tv_program_blocks b on b.schedule_version_id=v.id
where v.channel_id='ch-main' and v.state='published'
  and v.title like 'Grade fixa GSA TV%'
group by v.id, v.broadcast_date
order by v.broadcast_date;

select 'active_program', p.name, p.category, p.status,
       count(*) as block_count,
       count(distinct v.broadcast_date) as active_days,
       min(v.broadcast_date), max(v.broadcast_date),
       min(b.planned_start_offset_s), max(b.planned_start_offset_s),
       min(p.updated_at::text), max(p.updated_at::text)
from public.gsa_tv_schedule_versions v
join public.gsa_tv_program_blocks b on b.schedule_version_id=v.id
join public.gsa_tv_programs p on p.id=b.program_id
where v.channel_id='ch-main' and v.state='published'
  and v.title like 'Grade fixa GSA TV%'
group by p.id, p.name, p.category, p.status
order by p.name;

select 'representative_block', v.broadcast_date, b.position,
       b.planned_start_offset_s, b.planned_duration_s,
       p.name, coalesce(b.notes,''), coalesce(b.metadata::text,'{}')
from public.gsa_tv_schedule_versions v
join public.gsa_tv_program_blocks b on b.schedule_version_id=v.id
join public.gsa_tv_programs p on p.id=b.program_id
where v.channel_id='ch-main' and v.state='published'
  and v.broadcast_date between date '2026-09-04' and date '2026-09-10'
  and v.title like 'Grade fixa GSA TV%'
order by v.broadcast_date,b.position;

select 'unreferenced_program', p.name, p.category, p.status,
       p.created_at, p.updated_at
from public.gsa_tv_programs p
where p.channel_id='ch-main'
  and not exists (
    select 1
    from public.gsa_tv_schedule_versions v
    join public.gsa_tv_program_blocks b on b.schedule_version_id=v.id
    where v.channel_id=p.channel_id and v.state='published'
      and v.title like 'Grade fixa GSA TV%'
      and b.program_id=p.id
  )
order by p.name;

select 'interview_program', p.name, p.status, p.created_at, p.updated_at
from public.gsa_tv_programs p
where p.channel_id='ch-main' and (p.name ilike '%entrevist%' or coalesce(p.description,'') ilike '%entrevist%' or coalesce(p.notes,'') ilike '%entrevist%')
order by p.name;

select 'interview_block', v.broadcast_date, v.state, p.name, coalesce(b.notes,''), coalesce(b.metadata::text,'{}')
from public.gsa_tv_program_blocks b
join public.gsa_tv_schedule_versions v on v.id=b.schedule_version_id
left join public.gsa_tv_programs p on p.id=b.program_id
where coalesce(p.name,'') ilike '%entrevist%'
   or coalesce(b.notes,'') ilike '%entrevist%'
   or coalesce(b.metadata::text,'') ilike '%entrevist%'
order by v.broadcast_date desc
limit 100;

COMMIT;
`;

const remote = String.raw`set -euo pipefail
dburl=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
sudo docker run --rm -i --network host postgres:15-alpine psql "$dburl" -X -v ON_ERROR_STOP=1 -At -F '|' <<'SQL'
${sql}
SQL
`;

const result = await runSshScript(remote, 90000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
