import fs from 'node:fs';
import { runSshScript } from './ssh2-run.mjs';
const credentials=fs.readFileSync(new URL('../CREDENCIAIS_SISTEMA_GSA.md',import.meta.url),'utf8');
const password=credentials.match(/Senha Master:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
const pw=Buffer.from(password).toString('base64');
const sql=fs.readFileSync(new URL('../supabase/migrations/20260905000500_gsa_tv_restore_three_news_editions.sql',import.meta.url),'utf8');
const data=Buffer.from(sql).toString('base64');
const sh=`set -euo pipefail\nprintf '%s' '${data}'|base64 -d >/tmp/restore-three-news.sql\ninstall -m 0644 /tmp/restore-three-news.sql /home/opc/gsa-ai/migrations/20260905000500_gsa_tv_restore_three_news_editions.sql\nexport PGPASSWORD=$(printf '%s' '${pw}'|base64 -d)\npsql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -v ON_ERROR_STOP=1 -f /tmp/restore-three-news.sql\nrm -f /tmp/restore-three-news.sql\npsql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -At -F '|' -c "select p.name,p.status,count(s.id) from public.gsa_tv_programs p left join public.gsa_tv_weekly_grid_slots s on s.program_id=p.id and s.enabled where p.name in ('GSA News','GSA Manhã News','GSA Meio Dia News','GSA News Noite','GSA News Especial','GSA News Noturno') group by p.name,p.status order by p.name; select 'enabled_slots',count(*) from public.gsa_tv_weekly_grid_slots where enabled; select 'archived_alias_slots',count(*) from public.gsa_tv_weekly_grid_slots s join public.gsa_tv_programs p on p.id=s.program_id where s.enabled and p.status='archived';"`;
const result=await runSshScript(sh,120000);process.stdout.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);
