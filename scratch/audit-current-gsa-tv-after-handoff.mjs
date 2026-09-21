import { runSshScript } from './ssh2-run.mjs';

const script = String.raw`set -euo pipefail
dburl=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
echo "container|$(sudo docker inspect gsa-tv-control-plane --format '{{.Config.Image}}|{{.State.Status}}|{{.State.Health.Status}}')"
sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -F '|' -c "
select 'channel',id,status,desired_state,playout_state,signal_state,coalesce(last_error,''),coalesce(config->>'youtube_video_id',''),last_signal_at
from public.gsa_tv_channels where id='ch-main';"
echo "encoder_count|$(sudo docker top gsa-tv-control-plane -eo pid,args 2>/dev/null | grep -c '[f]fmpeg' || true)"
sudo docker top gsa-tv-control-plane -eo pid,args 2>/dev/null | grep '[f]fmpeg' | sed -E 's#(rtmps?://)[^ ]+#\1[PROTECTED]#g' | sed 's/^/encoder|/' || true
echo "health|$(curl -fsS --max-time 10 http://127.0.0.1:8787/health || true)"
video_id=$(sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -qAt -c "select coalesce(config->>'youtube_video_id','') from public.gsa_tv_channels where id='ch-main';")
if [ -n "$video_id" ]; then
  page=$(curl -fsSL --max-time 20 -A 'Mozilla/5.0 GSA-TV-Monitor/1.0' "https://www.youtube.com/watch?v=$video_id" || true)
  if printf '%s' "$page" | grep -q '"isLiveNow":true'; then
    echo "youtube|live|$video_id"
  elif printf '%s' "$page" | grep -q '"isLiveContent":true'; then
    echo "youtube|live_content|$video_id"
  else
    echo "youtube|unconfirmed|$video_id"
  fi
else
  echo 'youtube|missing_video_id'
fi
`;

const result = await runSshScript(script, 120000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
