import fs from'node:fs';import{runSshScript}from'./ssh2-run.mjs';
const c=fs.readFileSync(new URL('../CREDENCIAIS_SISTEMA_GSA.md',import.meta.url),'utf8');const p=c.match(/Senha Master:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();if(!p)throw new Error('Senha não encontrada.');const b=Buffer.from(p).toString('base64');
const remote=`set -euo pipefail
export PGPASSWORD=$(printf '%s' '${b}'|base64 -d)
base='psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -At'
job_id=$($base -c "insert into public.gsa_tv_jobs(channel_id,job_type,status,progress,payload) values('ch-main','stream_start','pending',0,'{}') returning id"|head -1)
for attempt in $(seq 1 90);do state=$($base -F '|' -c "select status||'|'||coalesce(error_message,'') from public.gsa_tv_jobs where id='$job_id'");case "$state" in completed*|failed*)break;;esac;sleep 2;done
printf 'stream_start|%s\n' "$state"
$base -F '|' -c "select 'channel',status,desired_state,playout_state,signal_state,coalesce(last_error,'') from public.gsa_tv_channels where id='ch-main'"
curl -fsS http://127.0.0.1:9204/metrics
sudo docker exec gsa-tv-control-plane sh -lc "ps -eo pid,comm,args | grep '[f]fmpeg' | sed -E 's#(rtmps?://[^/]+/)[^ ]+#\\1[PROTECTED]#g'"
`;
const r=await runSshScript(remote,210000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
