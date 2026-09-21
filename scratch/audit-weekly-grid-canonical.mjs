import fs from 'node:fs'; import {runSshScript} from './ssh2-run.mjs';
const c=fs.readFileSync(new URL('../CREDENCIAIS_SISTEMA_GSA.md',import.meta.url),'utf8');const pw=c.match(/Senha Master:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();const e=Buffer.from(pw).toString('base64');
const remote=String.raw`export PGPASSWORD=$(printf '%s' '${e}'|base64 -d)
psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -P pager=off <<'SQL'
\d+ public.gsa_tv_weekly_grid_slots
\d+ public.gsa_tv_schedule_versions
select 'WEEKLY_CANONICAL' section,p.name,p.status,count(*) slots,min(w.weekday) min_day,max(w.weekday) max_day
from public.gsa_tv_weekly_grid_slots w join public.gsa_tv_programs p on p.id=w.program_id
group by p.name,p.status order by p.name;
select 'VERSIONS' section,id,status,effective_from,effective_to,created_at,updated_at from public.gsa_tv_schedule_versions order by created_at desc limit 20;
SQL`;
const r=await runSshScript(remote,60000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
