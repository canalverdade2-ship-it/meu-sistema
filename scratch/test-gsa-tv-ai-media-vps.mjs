import fs from 'node:fs';
import { runSshScript } from './ssh2-run.mjs';

const credentials=fs.readFileSync(new URL('../CREDENCIAIS_SISTEMA_GSA.md',import.meta.url),'utf8');
const password=credentials.match(/Senha Master:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
if(!password)throw new Error('Senha de infraestrutura não encontrada.');
const pw64=Buffer.from(password).toString('base64');
const remote=`set -euo pipefail
export PGPASSWORD=$(printf '%s' '${pw64}' | base64 -d)
psql_base='psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -At'
run_test(){
  type="$1"; brief="$2"; agent="$3"; model="$4"
  project_id=$($psql_base -c "insert into public.gsa_tv_ai_projects(channel_id,name,title,project_type,brief,autonomy_mode,state,metadata,config,updated_at) values('ch-main','Prova real '||'$type','Prova real '||'$type','$type','$brief','assisted','queued','{}','{}',now()) returning id" | head -1)
  job_id=$($psql_base -c "insert into public.gsa_tv_ai_jobs(project_id,agent_type,job_type,provider,model,state,input,progress,priority,created_at,updated_at) values('$project_id','$agent','$agent','gemini','$model','queued','{}',0,'today',now(),now()) returning id" | head -1)
  for attempt in $(seq 1 150); do state=$($psql_base -F '|' -c "select state||'|'||coalesce(error_message,'') from public.gsa_tv_ai_jobs where id='$job_id'"); case "$state" in completed*|failed*) break;; esac; sleep 2; done
  printf '%s|%s|%s|%s\n' "$type" "$project_id" "$job_id" "$state"
  $psql_base -F '|' -c "select 'asset',asset_type,mime_type,size_bytes,(sha256 is not null),approval_state from public.gsa_tv_ai_assets where project_id='$project_id' order by created_at desc limit 1"
}
run_test image 'Arte horizontal abstrata para teste técnico da GSA TV, azul-marinho e dourado, sem marcas de terceiros e sem texto.' image_generation gemini-3.1-flash-image
run_test audio 'GSA TV. Teste técnico de locução concluído com sucesso.' speech_generation gemini-3.1-flash-tts-preview
`;
const result=await runSshScript(remote,360000);process.stdout.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);
