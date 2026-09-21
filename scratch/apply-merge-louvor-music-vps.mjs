import fs from 'node:fs';
import { runSshScript } from './ssh2-run.mjs';
const credentials=fs.readFileSync(new URL('../CREDENCIAIS_SISTEMA_GSA.md',import.meta.url),'utf8');
const password=credentials.match(/Senha Master:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
const pw=Buffer.from(password).toString('base64');
const sql=fs.readFileSync(new URL('../supabase/migrations/20260905001500_gsa_tv_merge_noite_de_louvor_into_music.sql',import.meta.url),'utf8');
const data=Buffer.from(sql).toString('base64');
const sh=`set -euo pipefail\nprintf '%s' '${data}'|base64 -d >/tmp/merge-louvor-music.sql\ninstall -m 0644 /tmp/merge-louvor-music.sql /home/opc/gsa-ai/migrations/20260905001500_gsa_tv_merge_noite_de_louvor_into_music.sql\nexport PGPASSWORD=$(printf '%s' '${pw}'|base64 -d)\npsql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -v ON_ERROR_STOP=1 -f /tmp/merge-louvor-music.sql\nrm -f /tmp/merge-louvor-music.sql\npsql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -At -F '|' -c "select p.name,p.status,count(s.id) from public.gsa_tv_programs p left join public.gsa_tv_weekly_grid_slots s on s.program_id=p.id and s.enabled where p.name in ('GSA Music','GSA Noite de Louvor') group by p.name,p.status order by p.name; select 'enabled_slots',count(*) from public.gsa_tv_weekly_grid_slots where enabled; select 'archived_alias_slots',count(*) from public.gsa_tv_weekly_grid_slots s join public.gsa_tv_programs p on p.id=s.program_id where s.enabled and p.status='archived';"`;
const result=await runSshScript(sh,120000);process.stdout.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);
