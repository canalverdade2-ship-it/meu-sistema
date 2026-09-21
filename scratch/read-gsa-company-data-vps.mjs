import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const creds=fs.readFileSync(new URL('../CREDENCIAIS_SISTEMA_GSA.md',import.meta.url),'utf8');
const key=creds.match(/Chave Privada:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
const password=creds.match(/Senha Master:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
if(!key||!password) throw new Error('Credenciais ausentes.');
const remote=`set -euo pipefail
export PGPASSWORD=$(printf '%s' '${Buffer.from(password).toString('base64')}' | base64 -d)
psql -q -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -At -v ON_ERROR_STOP=1 -c "select coalesce(row_to_json(e)::text,'{}') from (select razao_social,cnpj,telefone,responsavel from public.empresa order by id limit 1) e"
`;
const result=spawnSync('C:/Windows/System32/OpenSSH/ssh.exe',['-o','BatchMode=yes','-o','StrictHostKeyChecking=accept-new','-o','ConnectTimeout=12','-i',key,'opc@147.15.43.141','bash','-s'],{input:remote,encoding:'utf8',timeout:30000,maxBuffer:1024*1024});
if(result.status!==0){process.stderr.write(result.stderr||result.stdout);process.exit(result.status||1)}
process.stdout.write(result.stdout.trim());
