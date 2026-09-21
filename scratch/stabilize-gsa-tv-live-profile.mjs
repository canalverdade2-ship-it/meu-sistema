import {runSshScript} from './ssh2-run.mjs';const remote=String.raw`set -euo pipefail
dburl=$(sudo docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' gsa-tv-control-plane | sed -n 's/^DATABASE_URL=//p')
echo 'BEFORE'
sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -F '|' -c "select id,quality_profile,desired_state,playout_state,signal_state from public.gsa_tv_channels where id='ch-main';"
sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -v ON_ERROR_STOP=1 -c "update public.gsa_tv_channels set quality_profile='720p30',updated_at=now() where id='ch-main';" >/dev/null
pid=$(sudo ps -eo pid=,cmd= | awk '/ffmpeg .*rtmp:\/\/a\.rtmp\.youtube\.com\/live2\// {print $1; exit}')
sudo kill -TERM "$pid"
for i in $(seq 1 30); do sleep 1; new=$(sudo ps -eo pid=,cmd= | awk '/ffmpeg .*rtmp:\/\/a\.rtmp\.youtube\.com\/live2\// {print $1; exit}'); [ -n "$new" ] && [ "$new" != "$pid" ] && break; done
echo 'AFTER'
sudo ps -eo pid=,ni=,%cpu=,%mem=,cmd= | grep -E '[f]fmpeg .*rtmp://a\.rtmp\.youtube\.com/live2/'
uptime
`;
const r=await runSshScript(remote,60000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
