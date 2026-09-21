import fs from 'node:fs';
import { runSshScript } from './ssh2-run.mjs';

const credentials = fs.readFileSync(new URL('../CREDENCIAIS_SISTEMA_GSA.md', import.meta.url), 'utf8');
const password = credentials.match(/Senha Master:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
if (!password) throw new Error('Senha de infraestrutura não encontrada.');
const encoded = Buffer.from(password).toString('base64');
const sql = `select 'program',to_jsonb(p)::text from public.gsa_tv_programs p where lower(name) like '%tá na rede%' order by name; select 'slot',p.name,s.weekday,s.start_time,s.end_time,coalesce(s.segment_variant,''),s.content_mode,s.enabled from public.gsa_tv_weekly_grid_slots s join public.gsa_tv_programs p on p.id=s.program_id where lower(p.name) like '%tá na rede%' order by s.start_time,p.name,s.weekday;`;
const remote = `export PGPASSWORD=$(printf '%s' '${encoded}' | base64 -d)\npsql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -At -F '|' -c "${sql}"`;
const result = await runSshScript(remote, 30000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
