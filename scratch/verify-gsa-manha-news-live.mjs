import { runSshScript } from './ssh2-run.mjs';

const script = String.raw`set -euo pipefail
media_id='media-gsa-manha-news-2026-09-04-draft-qc-v1'
job_id='50366862-10d2-421a-82d5-7e2d56f3c07f'
dburl=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')

sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -F '|' -c "
select 'job',id,status,progress,coalesce(error_message,''),created_at,updated_at
from public.gsa_tv_jobs where id='$job_id';
select 'channel',status,desired_state,playout_state,signal_state,coalesce(last_error,''),last_signal_at
from public.gsa_tv_channels where id='ch-main';
select 'tomorrow',v.broadcast_date,b.planned_start_offset_s,b.planned_duration_s,b.media_item_id,v.state
from public.gsa_tv_program_blocks b join public.gsa_tv_schedule_versions v on v.id=b.schedule_version_id
where b.id='8595acfe-b8d4-4b11-bd94-bae1e4f097c6';"

sudo docker top gsa-tv-control-plane -eo pid,args | grep -F "$media_id" | sed 's/^/encoder_process|/'

video_id=$(sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -qAt -c "
select coalesce(config->>'youtube_video_id','') from public.gsa_tv_channels where id='ch-main';")
echo "youtube_video_id|$video_id"
if [ -n "$video_id" ]; then
  page=$(curl -fsSL --max-time 20 -A 'Mozilla/5.0 GSA-TV-Monitor/1.0' "https://www.youtube.com/watch?v=$video_id")
  if printf '%s' "$page" | grep -q '"isLiveNow":true'; then
    echo "youtube_public|live_now|$video_id"
  elif printf '%s' "$page" | grep -q '"isLiveContent":true'; then
    echo "youtube_public|live_content|$video_id"
  else
    echo "youtube_public|unconfirmed|$video_id"
  fi
fi
`;

const result = await runSshScript(script, 90000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
