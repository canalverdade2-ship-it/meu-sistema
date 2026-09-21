import { runSshScript } from './ssh2-run.mjs';
const result=await runSshScript(`set -eu
rm -f /tmp/gsa-news-live-audio-30s.wav /tmp/gsa-news-live-capture.log
sudo docker exec gsa-tv-encoder-engine sh -lc "ffmpeg -hide_banner -loglevel warning -y -t 30 -i /runtime/hls/program.m3u8 -map 0:a:0 -c:a pcm_s24le -ar 48000 -ac 2 /tmp/gsa-news-live-audio-30s.wav" 2>/tmp/gsa-news-live-capture.log
sudo docker exec gsa-tv-encoder-engine ffmpeg -hide_banner -nostats -i /tmp/gsa-news-live-audio-30s.wav -af "astats=metadata=1:reset=0,ebur128=peak=true" -f null - 2>&1 | tail -n 70
printf '%s\n' '--- capture_warnings ---'
cat /tmp/gsa-news-live-capture.log
printf '%s\n' '--- current_state ---'
database_url=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
sudo docker run --rm --network host postgres:15-alpine psql "$database_url" -X -qAt -F '|' -c "select status,desired_state,playout_state,signal_state,coalesce(last_error,''),last_signal_at from public.gsa_tv_channels where id='ch-main'"
printf 'rtmp_publishers|'; sudo docker top gsa-tv-encoder-engine -eo pid,args | grep -c '[a]\.rtmp\.youtube\.com/live2' || true
`,55000);
process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');
