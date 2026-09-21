import { runSshScript } from './ssh2-run.mjs';
const result=await runSshScript(`set -eu
database_url=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
sudo docker run --rm --network host postgres:15-alpine psql "$database_url" -X -At -F '|' -c "select status,desired_state,playout_state,signal_state,last_signal_at,coalesce(config->>'youtube_video_id','') from public.gsa_tv_channels where id='ch-main';"
sudo docker inspect -f '{{.Name}}|{{.State.Status}}|{{.State.Health.Status}}' gsa-tv-control-plane gsa-tv-watchdog gsa-tv-encoder-engine
printf 'rtmp_connections|'
sudo nsenter -t 1 -n ss -tnp 2>/dev/null | grep -c 'a.rtmp.youtube.com\|:1935' || true
printf 'rtmp_publishers|'
sudo docker top gsa-tv-encoder-engine -eo pid,args | grep -c '[a]\.rtmp\.youtube\.com/live2' || true
`,30000);
process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');
