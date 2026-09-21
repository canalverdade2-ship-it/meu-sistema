import fs from 'node:fs';
import { runSshScript } from './ssh2-run.mjs';
const credentials=fs.readFileSync(new URL('../CREDENCIAIS_SISTEMA_GSA.md',import.meta.url),'utf8');
const password=credentials.match(/Senha Master:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
if(!password)throw new Error('Credencial indisponível');
const encoded=Buffer.from(password).toString('base64');
const remote=String.raw`export PGPASSWORD=$(printf '%s' '${encoded}'|base64 -d)
psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -P pager=off <<'SQL'
\d+ public.gsa_tv_programs
\d+ public.gsa_tv_program_blocks
\d+ public.gsa_tv_schedule_slots
select 'BLOCKS_BY_PROGRAM' as section, p.name, p.status, count(*) as blocks
from public.gsa_tv_program_blocks b join public.gsa_tv_programs p on p.id=b.program_id
group by p.name,p.status order by p.name;
select 'SLOTS_14D' as section, coalesce(p.name,s.title,'<sem nome>') as program, count(*) as slots, min(s.scheduled_start), max(s.scheduled_end)
from public.gsa_tv_schedule_slots s left join public.gsa_tv_programs p on p.id=s.program_id
where s.scheduled_start >= now()-interval '1 day' and s.scheduled_start < now()+interval '14 days'
group by coalesce(p.name,s.title,'<sem nome>') order by program;
select 'RECENT_PROGRAM_CHANGES' as section,id,name,status,created_at,updated_at
from public.gsa_tv_programs order by updated_at desc nulls last limit 30;
SQL`;
const r=await runSshScript(remote,60000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
