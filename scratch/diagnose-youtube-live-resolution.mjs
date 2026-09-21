import { runSshScript } from './ssh2-run.mjs';
const script=String.raw`set -euo pipefail
dburl=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}'|awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -F '|' -c "select 'channel',quality_profile,status,desired_state,playout_state,signal_state,last_signal_at,coalesce(config->>'youtube_video_id','') from public.gsa_tv_channels where id='ch-main';"
echo 'encoder_begin'
sudo docker top gsa-tv-control-plane -eo pid,args | grep -F 'rtmp://a.rtmp.youtube.com' | head -1
echo 'encoder_end'
echo 'recent_logs_begin'
sudo docker logs --since 20m gsa-tv-control-plane 2>&1 | grep -Ei 'youtube|ffmpeg|rtmp|error|warning|stream_(start|exit)' | tail -80 || true
echo 'recent_logs_end'
video_id=$(sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -qAt -c "select coalesce(config->>'youtube_video_id','') from public.gsa_tv_channels where id='ch-main';")
if command -v yt-dlp >/dev/null 2>&1; then
  yt-dlp --no-warnings --skip-download -F "https://www.youtube.com/watch?v=$video_id" | tail -60
else
  echo 'yt_dlp_missing'
fi
`;
const result=await runSshScript(script,90000);process.stdout.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);
