import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const creds=fs.readFileSync(new URL('../CREDENCIAIS_SISTEMA_GSA.md',import.meta.url),'utf8');
const key=creds.match(/Chave Privada:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
const password=creds.match(/Senha Master:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
if(!key||!password) throw new Error('Credenciais ausentes.');
const sql=fs.readFileSync(new URL('../supabase/migrations/20260831143000_admin_cancel_delete_partner_redemptions.sql',import.meta.url),'utf8');
const remote=`set -euo pipefail
export PGPASSWORD=$(printf '%s' '${Buffer.from(password).toString('base64')}' | base64 -d)
printf '%s' '${Buffer.from(sql).toString('base64')}' | base64 -d | psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -v ON_ERROR_STOP=1
psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -At -v ON_ERROR_STOP=1 <<'SQL'
select 'cancel_rpc='||coalesce(to_regprocedure('public.gsa_admin_cancel_partner_redemption(uuid,text,uuid,text)')::text,'missing');
select 'delete_rpc='||coalesce(to_regprocedure('public.gsa_admin_delete_partner_redemption(uuid,text,uuid,text)')::text,'missing');
select 'anon_cancel='||has_function_privilege('anon','public.gsa_admin_cancel_partner_redemption(uuid,text,uuid,text)','EXECUTE');
select 'auth_cancel='||has_function_privilege('authenticated','public.gsa_admin_cancel_partner_redemption(uuid,text,uuid,text)','EXECUTE');
select 'columns='||count(*) from information_schema.columns where table_schema='public' and table_name='parceiros_resgates' and column_name in ('motivo_cancelamento','cancelado_por','data_cancelamento');
SQL`;
const result=spawnSync('C:/Windows/System32/OpenSSH/ssh.exe',['-o','BatchMode=yes','-o','StrictHostKeyChecking=accept-new','-o','ConnectTimeout=12','-i',key,'opc@147.15.43.141','bash','-s'],{input:remote,encoding:'utf8',timeout:60000,maxBuffer:2*1024*1024});
if(result.status!==0){process.stderr.write(result.stderr||result.stdout);process.exit(result.status||1)}
process.stdout.write(result.stdout);
