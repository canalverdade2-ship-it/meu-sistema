import fs from 'node:fs';
import { runSshScript } from './ssh2-run.mjs';

const credentials=fs.readFileSync(new URL('../CREDENCIAIS_SISTEMA_GSA.md',import.meta.url),'utf8');
const password=credentials.match(/Senha Master:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
if(!password) throw new Error('Senha de infraestrutura não encontrada.');
const encoded=Buffer.from(password).toString('base64');
const sql=`select tc.table_name,kcu.column_name,tc.constraint_name,rc.delete_rule from information_schema.table_constraints tc join information_schema.key_column_usage kcu on tc.constraint_name=kcu.constraint_name and tc.constraint_schema=kcu.constraint_schema join information_schema.referential_constraints rc on rc.constraint_name=tc.constraint_name and rc.constraint_schema=tc.constraint_schema join information_schema.constraint_column_usage ccu on ccu.constraint_name=tc.constraint_name and ccu.constraint_schema=tc.constraint_schema where tc.constraint_type='FOREIGN KEY' and ccu.table_schema='public' and ccu.table_name='gsa_tv_programs' and ccu.column_name='id' order by tc.table_name,kcu.column_name; select 'constraint',conrelid::regclass::text,pg_get_constraintdef(oid) from pg_constraint where conrelid in ('public.gsa_tv_programs'::regclass,'public.gsa_tv_program_source_links'::regclass) and contype in ('c','u','p');`;
const remote=`export PGPASSWORD=$(printf '%s' '${encoded}' | base64 -d)\npsql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -At -F '|' -c "${sql}"`;
const result=await runSshScript(remote,60000);
process.stdout.write(result.stdout);
if(result.stderr) process.stderr.write(result.stderr);
