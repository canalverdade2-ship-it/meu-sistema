import fs from 'node:fs';
import { runSshScript } from './ssh2-run.mjs';
const credentials=fs.readFileSync(new URL('../CREDENCIAIS_SISTEMA_GSA.md',import.meta.url),'utf8');
const password=credentials.match(/Senha Master:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
const encoded=Buffer.from(password).toString('base64');
const sql=`select table_name,string_agg(column_name,',' order by ordinal_position) from information_schema.columns where table_schema='public' and table_name in ('gsa_tv_program_source_links','gsa_tv_weekly_grid_slots') group by table_name order by table_name;`;
const remote=`export PGPASSWORD=$(printf '%s' '${encoded}' | base64 -d)\npsql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -At -F '|' -c "${sql}"`;
const result=await runSshScript(remote,60000);process.stdout.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);
