import fs from 'node:fs';
import { runSshScript } from './ssh2-run.mjs';

const credentials=fs.readFileSync(new URL('../CREDENCIAIS_SISTEMA_GSA.md',import.meta.url),'utf8');
const password=credentials.match(/Senha Master:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
if(!password) throw new Error('Senha de infraestrutura não encontrada.');
const encodedPassword=Buffer.from(password).toString('base64');
const sql=fs.readFileSync(new URL('../supabase/migrations/20260904235900_gsa_tv_consolidate_program_names.sql',import.meta.url),'utf8');
const encodedSql=Buffer.from(sql,'utf8').toString('base64');
const remote=`set -euo pipefail
printf '%s' '${encodedSql}'|base64 -d >/tmp/20260904235900_gsa_tv_consolidate_program_names.sql
mkdir -p /home/opc/gsa-ai/migrations
sudo install -m 0644 /tmp/20260904235900_gsa_tv_consolidate_program_names.sql /home/opc/gsa-ai/migrations/20260904235900_gsa_tv_consolidate_program_names.sql
export PGPASSWORD=$(printf '%s' '${encodedPassword}'|base64 -d)
psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -v ON_ERROR_STOP=1 -f /tmp/20260904235900_gsa_tv_consolidate_program_names.sql
rm -f /tmp/20260904235900_gsa_tv_consolidate_program_names.sql
psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -At -F '|' -c "select 'published_programs',count(*) from public.gsa_tv_programs where channel_id='ch-main' and status='published'; select 'archived_aliases',count(*) from public.gsa_tv_programs where status='archived' and notes like 'Nome complementar consolidado%'; select 'enabled_slots',count(*) from public.gsa_tv_weekly_grid_slots where enabled=true; select 'alias_slots',count(*) from public.gsa_tv_weekly_grid_slots s join public.gsa_tv_programs p on p.id=s.program_id where p.status='archived' and s.enabled=true; select 'news_slot',p.name,s.weekday,s.start_time,s.end_time,coalesce(s.segment_variant,'') from public.gsa_tv_weekly_grid_slots s join public.gsa_tv_programs p on p.id=s.program_id where p.name='GSA News' and s.enabled=true order by s.weekday,s.start_time;"
`;
const result=await runSshScript(remote,120000);process.stdout.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);
