import { runSshScript } from './ssh2-run.mjs';

const script = String.raw`set -euo pipefail
media_id='media-gsa-manha-news-2026-09-04-draft-qc-v1'
dburl=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')

gate=$(sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -F '|' -c "
select state||'|'||approval_state||'|'||rights_ok
from public.gsa_tv_media_items
where id='$media_id';")
echo "gate|$gate"
test "$gate" = 'ready|approved|true'

job_id=$(sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -qAt -c "
insert into public.gsa_tv_jobs(channel_id,job_type,status,progress,payload)
values('ch-main','media_take','pending',0,jsonb_build_object(
  'media_item_id','$media_id',
  'source','explicit_user_live_take',
  'authorized_by','Adriano Farias'
)) returning id;")
echo "media_take_job|$job_id"

for i in $(seq 1 40); do
  row=$(sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -F '|' -c "
    select status||'|'||coalesce(error_message,'') from public.gsa_tv_jobs where id='$job_id';")
  case "$row" in
    completed'|'*) break ;;
    failed'|'*) echo "$row"; exit 1 ;;
  esac
  sleep 1
done
status=$(printf '%s' "$row" | cut -d'|' -f1)
test "$status" = 'completed'
echo "media_take_result|$row"
sleep 8

sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -F '|' <<'SQL'
select 'channel',status,desired_state,playout_state,signal_state,coalesce(last_error,''),last_signal_at
from public.gsa_tv_channels where id='ch-main';
SQL

channel=$(sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -F '|' -c "
select status||'|'||desired_state||'|'||playout_state||'|'||signal_state||'|'||coalesce(last_error,'')
from public.gsa_tv_channels where id='ch-main';")
case "$channel" in
  online'|'running'|'media:'"$media_id"'|'sending'|'*) ;;
  *) echo "unexpected_channel|$channel"; exit 1 ;;
esac

sudo docker top gsa-tv-control-plane -eo pid,args | grep -F "$media_id" | sed 's/^/encoder_process|/'

video_id=$(sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -qAt -c "
select coalesce(config->>'youtube_video_id','') from public.gsa_tv_channels where id='ch-main';")
if [ -n "$video_id" ]; then
  page=$(curl -fsSL --max-time 15 -A 'Mozilla/5.0 GSA-TV-Monitor/1.0' "https://www.youtube.com/watch?v=$video_id")
  if printf '%s' "$page" | grep -q '"isLiveNow":true'; then
    echo "youtube_public|live|$video_id"
  elif printf '%s' "$page" | grep -q '"isLiveContent":true'; then
    echo "youtube_public|live_content_detected|$video_id"
  else
    echo "youtube_public|unconfirmed|$video_id"
  fi
else
  echo 'youtube_public|video_id_missing'
fi

sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -F '|' -c "
select 'scheduled_block',v.broadcast_date,b.planned_start_offset_s,b.planned_duration_s,b.media_item_id
from public.gsa_tv_program_blocks b join public.gsa_tv_schedule_versions v on v.id=b.schedule_version_id
where b.id='8595acfe-b8d4-4b11-bd94-bae1e4f097c6';"
`;

const result = await runSshScript(script, 120000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
