import fs from 'node:fs';
import { runSshScript } from './ssh2-run.mjs';

const credentials=fs.readFileSync(new URL('../CREDENCIAIS_SISTEMA_GSA.md',import.meta.url),'utf8');
const password=credentials.match(/Senha Master:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
if(!password)throw new Error('Senha de infraestrutura não encontrada.');
const pw64=Buffer.from(password).toString('base64');
const remote=`set -euo pipefail
export PGPASSWORD=$(printf '%s' '${pw64}' | base64 -d)
psql_base='psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -At'
project_id=$($psql_base -c "insert into public.gsa_tv_ai_projects(channel_id,name,title,project_type,brief,autonomy_mode,state,metadata,config,updated_at) values('ch-main','Prova real Gemini','Prova real Gemini','script','Crie uma chamada institucional de 20 segundos para a GSA TV, em português do Brasil, sem inventar preços nem dados.','assisted','queued','{}','{}',now()) returning id" | head -1)
job_id=$($psql_base -c "insert into public.gsa_tv_ai_jobs(project_id,agent_type,job_type,provider,model,state,input,progress,priority,created_at,updated_at) values('$project_id','editorial_orchestrator','editorial_orchestrator','gemini','gemini-2.5-flash','queued','{}',0,'today',now(),now()) returning id" | head -1)
for attempt in $(seq 1 90); do
  state=$($psql_base -F '|' -c "select state||'|'||coalesce(error_message,'') from public.gsa_tv_ai_jobs where id='$job_id'")
  case "$state" in completed*|failed*) break;; esac
  sleep 2
done
printf 'project|%s\njob|%s|%s\n' "$project_id" "$job_id" "$state"
$psql_base -F '|' -c "select 'result',p.state,j.state,j.provider,j.model,length(coalesce(j.output->>'text','')),coalesce(j.output->'usage'->>'input_tokens',''),coalesce(j.output->'usage'->>'output_tokens','') from public.gsa_tv_ai_projects p join public.gsa_tv_ai_jobs j on j.project_id=p.id where j.id='$job_id'"
`;
const result=await runSshScript(remote,210000);process.stdout.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);
