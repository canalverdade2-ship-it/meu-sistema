import fs from 'node:fs';
import { runSshScript } from './ssh2-run.mjs';

const credentials=fs.readFileSync(new URL('../CREDENCIAIS_SISTEMA_GSA.md',import.meta.url),'utf8');
const password=credentials.match(/Senha Master:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
if(!password) throw new Error('Senha de infraestrutura não encontrada.');
const encoded=Buffer.from(password).toString('base64');
const sql=`select 'program',p.id,p.name,p.category,p.default_duration_s,p.status,count(s.id) as slots,string_agg(distinct coalesce(s.segment_variant,''),' / ' order by coalesce(s.segment_variant,'')) as variants from public.gsa_tv_programs p left join public.gsa_tv_weekly_grid_slots s on s.program_id=p.id and s.enabled=true where p.channel_id='ch-main' group by p.id,p.name,p.category,p.default_duration_s,p.status order by p.name; select 'slot',p.name,s.weekday,s.start_time,s.end_time,coalesce(s.segment_variant,''),s.content_mode from public.gsa_tv_weekly_grid_slots s join public.gsa_tv_programs p on p.id=s.program_id where s.enabled=true order by s.weekday,s.start_time,p.name;`;
const remote=`export PGPASSWORD=$(printf '%s' '${encoded}' | base64 -d)\npsql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -At -F '|' -c "${sql}"`;
const result=await runSshScript(remote,60000);
process.stdout.write(result.stdout);
if(result.stderr) process.stderr.write(result.stderr);
