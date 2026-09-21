import { runSshScript } from './ssh2-run.mjs';

const remote = String.raw`set -euo pipefail
dburl=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print}')
sudo docker run --rm -i --network host postgres:15-alpine psql "$dburl" -X -v ON_ERROR_STOP=1 <<'SQL'
begin;
insert into public.gsa_tv_programs(channel_id,name,description,category,default_duration_s,status,notes)
select 'ch-main','Continuidade GSA TV','Grade técnica de segurança utilizada quando ainda não há programação editorial publicada.','continuidade',86400,'published','Não substituir automaticamente uma grade editorial existente.'
where not exists(select 1 from public.gsa_tv_programs where channel_id='ch-main' and name='Continuidade GSA TV');

with dates as (
  select (now() at time zone 'America/Sao_Paulo')::date as d
  union all
  select (now() at time zone 'America/Sao_Paulo')::date + 1
)
insert into public.gsa_tv_schedule_versions(channel_id,broadcast_date,version,state,title,notes,approved_at,published_at)
select 'ch-main',d,1,'published','Grade técnica de continuidade','Mantém o sinal 24h até a publicação da grade editorial.',now(),now()
from dates
where not exists(
  select 1 from public.gsa_tv_schedule_versions v
  where v.channel_id='ch-main' and v.broadcast_date=dates.d and v.state='published'
);

insert into public.gsa_tv_program_blocks(schedule_version_id,program_id,block_type,position,planned_start_offset_s,planned_duration_s,cannot_interrupt,notes,metadata)
select v.id,p.id,'reserve',0,0,86400,false,'Continuidade automática 24h','{"system_continuity":true}'::jsonb
from public.gsa_tv_schedule_versions v
join public.gsa_tv_programs p on p.channel_id=v.channel_id and p.name='Continuidade GSA TV'
where v.channel_id='ch-main'
  and v.state='published'
  and v.broadcast_date between (now() at time zone 'America/Sao_Paulo')::date and (now() at time zone 'America/Sao_Paulo')::date+1
  and not exists(select 1 from public.gsa_tv_program_blocks b where b.schedule_version_id=v.id);
commit;
select v.broadcast_date,v.state,v.title,count(b.id) blocks,sum(b.planned_duration_s) duration_s
from public.gsa_tv_schedule_versions v
left join public.gsa_tv_program_blocks b on b.schedule_version_id=v.id
where v.channel_id='ch-main' and v.broadcast_date between (now() at time zone 'America/Sao_Paulo')::date and (now() at time zone 'America/Sao_Paulo')::date+1
group by v.id order by v.broadcast_date,v.version;
SQL
token=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="INTERNAL_API_TOKEN"{sub(/^INTERNAL_API_TOKEN=/,"");print;exit}')
curl -sS -X POST -H "Authorization: Bearer $token" -H 'Content-Type: application/json' -d '{"job_type":"compile_playlist","payload":{"source":"continuity-bootstrap"}}' http://127.0.0.1:9202/automation/jobs
echo
`;

const result = await runSshScript(remote, 90000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
