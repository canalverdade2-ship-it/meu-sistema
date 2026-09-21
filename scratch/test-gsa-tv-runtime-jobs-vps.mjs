import fs from 'node:fs';
import { runSshScript } from './ssh2-run.mjs';
const credentials=fs.readFileSync(new URL('../CREDENCIAIS_SISTEMA_GSA.md',import.meta.url),'utf8');
const password=credentials.match(/Senha Master:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
if(!password)throw new Error('Senha de infraestrutura não encontrada.');
const pw64=Buffer.from(password).toString('base64');
const remote=`set -euo pipefail
export PGPASSWORD=$(printf '%s' '${pw64}' | base64 -d)
psql_base='psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -At'
for job_type in validate_schedule compile_playlist credentials_check relay_check; do
  job_id=$($psql_base -c "insert into public.gsa_tv_jobs(channel_id,job_type,status,progress,payload) values('ch-main','$job_type','pending',0,'{}') returning id" | head -1)
  for attempt in $(seq 1 30); do
    state=$($psql_base -F '|' -c "select status||'|'||coalesce(error_message,'') from public.gsa_tv_jobs where id='$job_id'")
    case "$state" in completed*|failed*) break;; esac
    sleep 1
  done
  printf '%s|%s\n' "$job_type" "$state"
done
sudo find /opt/gsa-tv/playlists/1 -maxdepth 1 -type f -name '*.json' -printf 'playlist|%f|%s\n' | sort | tail -5
`;
const result=await runSshScript(remote,60000);process.stdout.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);
