import fs from 'node:fs';
import { runSshScript } from './ssh2-run.mjs';
const credentials=fs.readFileSync(new URL('../CREDENCIAIS_SISTEMA_GSA.md',import.meta.url),'utf8');
const password=credentials.match(/Senha Master:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
if(!password)throw new Error('Credencial indisponível');
const encoded=Buffer.from(password).toString('base64');
const result=await runSshScript(String.raw`
export PGPASSWORD=$(printf '%s' '${encoded}' | base64 -d)
psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -At -F '|' <<'SQL'
select 'program',id,name,status from public.gsa_tv_programs order by name;
select 'media',id,title,media_kind,state from public.gsa_tv_media_items where title ~* '(motores|motor|clima|tempo|cidadania|financeiro|mercado)' order by title;
select 'block_note',id,coalesce(notes,''),coalesce(metadata::text,'') from public.gsa_tv_program_blocks where coalesce(notes,'') ~* '(motores|clima|cidadania|financeiro)' or coalesce(metadata::text,'') ~* '(motores|clima|cidadania|financeiro)' limit 100;
SQL
`,30000);
process.stdout.write(result.stdout); if(result.stderr)process.stderr.write(result.stderr);
