import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const creds=fs.readFileSync(new URL('../CREDENCIAIS_SISTEMA_GSA.md',import.meta.url),'utf8');
const key=creds.match(/Chave Privada:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
const password=creds.match(/Senha Master:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
if(!key||!password) throw new Error('Credenciais ausentes.');
const pw64=Buffer.from(password).toString('base64');
const remote=`set -euo pipefail
export PGPASSWORD=$(printf '%s' '${pw64}' | base64 -d)
sleep 8
echo container=$(sudo docker inspect --format '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}' gsa-tv-control-plane)
echo health=$(curl --fail --silent http://127.0.0.1:9202/health)
job_id=$(psql -q -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -At -v ON_ERROR_STOP=1 -c "insert into public.gsa_tv_jobs(channel_id,job_type,status,progress,payload) values('ch-main','health_check','pending',0,'{}') returning id")
sleep 8
psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -At -F '|' -v ON_ERROR_STOP=1 -c "select 'channel',status,(last_heartbeat_at>now()-interval '2 minutes'),coalesce(last_error,'') from public.gsa_tv_channels where id='ch-main'; select 'job',job_type,status,progress,coalesce(error_message,'') from public.gsa_tv_jobs where id='$job_id'; select 'open_incidents',count(*) from public.gsa_tv_incidents where not resolved;"
`;
const result=spawnSync('C:/Windows/System32/OpenSSH/ssh.exe',['-o','BatchMode=yes','-o','StrictHostKeyChecking=accept-new','-o','ConnectTimeout=12','-i',key,'opc@147.15.43.141','bash','-s'],{input:remote,encoding:'utf8',timeout:45000,maxBuffer:1024*1024});
if(result.status!==0){process.stderr.write(result.stderr||result.stdout);process.exit(result.status||1)}
process.stdout.write(result.stdout);
