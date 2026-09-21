import fs from 'node:fs';
import { runSshScript } from './ssh2-run.mjs';

const credentials = fs.readFileSync(new URL('../CREDENCIAIS_SISTEMA_GSA.md', import.meta.url), 'utf8');
const password = credentials.match(/Senha Master:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
if (!password) throw new Error('Credencial de infraestrutura indisponível.');
const encoded = Buffer.from(password).toString('base64');

const remote = String.raw`set -euo pipefail
echo CONTAINERS
sudo docker ps --filter 'name=gsa-tv' --format '{{.Names}}|{{.Image}}|{{.Status}}'
echo HEALTH
curl -fsS --max-time 8 http://127.0.0.1:9202/health || true
echo
curl -fsS --max-time 8 http://127.0.0.1:9204/metrics | grep '^gsa_tv_' || true
echo HLS_PROBE
sudo docker exec gsa-tv-ffplayout ffprobe -v error -show_entries stream=index,codec_name,codec_type,width,height,r_frame_rate,sample_rate,channels -of compact=p=0:nk=0 http://127.0.0.1:8787/public/1/live/stream.m3u8 || true
echo DATABASE
export PGPASSWORD=$(printf '%s' '${encoded}' | base64 -d)
psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -At -F '|' <<'SQL'
select 'channel',id,status,desired_state,playout_state,signal_state,quality_profile,coalesce(config->>'youtube_video_id',''),coalesce(last_error,'') from public.gsa_tv_channels where id='ch-main';
select 'schema_column',table_name,column_name from information_schema.columns where table_schema='public' and table_name like 'gsa_tv_%' and (table_name like '%execution%' or table_name like '%as_run%' or table_name='gsa_tv_schedule_versions') order by table_name,ordinal_position;
select 'latest_execution',id,coalesce(media_item_id,''),coalesce(title,''),coalesce(source,''),started_at,coalesce(ended_at::text,''),coalesce(outcome,'') from public.gsa_tv_execution_log where channel_id='ch-main' order by started_at desc limit 8;
select 'latest_as_run',id,coalesce(media_item_id,''),started_at,coalesce(ended_at::text,''),coalesce(outcome,''),coalesce(details::text,'') from public.gsa_tv_as_run where channel_id='ch-main' order by started_at desc limit 8;
select 'schedule_version',id,broadcast_date,version,state,title,coalesce(approved_at::text,''),coalesce(published_at::text,'') from public.gsa_tv_schedule_versions where channel_id='ch-main' order by coalesce(published_at,created_at) desc limit 8;
select 'future_slots',count(*),min(scheduled_start),max(scheduled_end) from public.gsa_tv_schedule_slots where channel_id='ch-main' and scheduled_end>now();
select 'open_incident',id,severity,message,created_at from public.gsa_tv_incidents where channel_id='ch-main' and not resolved order by created_at desc;
select 'recent_failed_job',id,job_type,left(coalesce(error_message,''),240),created_at from public.gsa_tv_jobs where channel_id='ch-main' and status='failed' order by created_at desc limit 8;
select 'recent_job',job_type,status,created_at,finished_at from public.gsa_tv_jobs where channel_id='ch-main' order by created_at desc limit 12;
SQL
`;

const result = await runSshScript(remote, 60000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
