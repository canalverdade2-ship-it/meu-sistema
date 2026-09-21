import fs from 'node:fs';
import { runSshScript } from './ssh2-run.mjs';

const credentials=fs.readFileSync(new URL('../CREDENCIAIS_SISTEMA_GSA.md',import.meta.url),'utf8');
const password=credentials.match(/Senha Master:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
if(!password)throw new Error('Senha de infraestrutura não encontrada.');
const pw64=Buffer.from(password).toString('base64');
const remote=`set -euo pipefail
export PGPASSWORD=$(printf '%s' '${pw64}' | base64 -d)
psql_base='psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -At'
media_id='media-normalization-proof'
sudo docker exec gsa-tv-control-plane ffmpeg -hide_banner -nostdin -loglevel error -y -f lavfi -i testsrc2=size=640x360:rate=15 -t 3 -c:v mpeg4 -q:v 5 -an /media/1/incoming/gsa-tv-normalization-proof.avi
$psql_base -c "insert into public.gsa_tv_media_items(id,channel_id,title,original_filename,duration_s,state,rights_ok,drive_path,media_kind,source_type,approval_state,metadata,updated_at) values('$media_id','ch-main','Prova de normalização broadcast','gsa-tv-normalization-proof.avi',3,'processing',true,'/media/1/incoming/gsa-tv-normalization-proof.avi','program','uploaded','approved','{}',now()) on conflict(id) do update set state='processing',drive_path=excluded.drive_path,updated_at=now(); delete from public.gsa_tv_jobs where channel_id='ch-main' and job_type='probe_media' and payload->>'media_item_id'='$media_id' and status in ('pending','running'); insert into public.gsa_tv_jobs(channel_id,job_type,status,progress,payload) values('ch-main','probe_media','pending',0,jsonb_build_object('media_item_id','$media_id'));" >/dev/null
for attempt in $(seq 1 120); do
  state=$($psql_base -F '|' -c "select status||'|'||coalesce(error_message,'') from public.gsa_tv_jobs where channel_id='ch-main' and job_type='probe_media' and payload->>'media_item_id'='$media_id' order by created_at desc limit 1")
  case "$state" in completed*|failed*) break;; esac
  sleep 1
done
printf 'job|%s\n' "$state"
$psql_base -F '|' -c "select 'media',id,state,video_codec,video_width,video_height,video_fps,audio_codec,audio_sample_rate,audio_channels,metadata->>'normalized' from public.gsa_tv_media_items where id='$media_id'"
`;
const result=await runSshScript(remote,150000);process.stdout.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);
