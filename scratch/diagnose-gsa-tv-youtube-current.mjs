import { runSshScript } from './ssh2-run.mjs';

const remote = String.raw`set -euo pipefail
dburl=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print}')
echo CHANNEL
sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -F '|' -c "select desired_state,playout_state,signal_state,last_signal_at,last_error,coalesce(nullif(config->>'youtube_video_id',''),'NO_VIDEO_ID') from public.gsa_tv_channels where id='ch-main'; select 'credentials',(stream_key_ciphertext is not null),rtmp_server,updated_at from public.gsa_tv_channel_secrets where channel_id='ch-main';"
echo RELAY_PROCESS
ps -eo pid,etimes,%cpu,%mem,args | grep -E '[f]fmpeg.*rtmp' | sed -E 's#(live2/)[^ ]+#\1[PROTECTED]#g' || true
echo RTMP_CONNECTION
sudo ss -tnp | grep ':1935' | sed -E 's/users:.*/users:[PROTECTED]/' || true
echo CONTROL_LOG
sudo docker logs --since 20m gsa-tv-control-plane 2>&1 | sed -E 's#(live2/)[^ ]+#\1[PROTECTED]#g' | tail -100
echo HEALTH
curl -fsS http://127.0.0.1:9202/health
echo
`;
const result = await runSshScript(remote, 30000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
