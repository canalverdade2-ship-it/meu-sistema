import {runSshScript} from './ssh2-run.mjs';const remote=String.raw`set -euo pipefail
pids=$(sudo ps -eo pid=,cmd= | awk '/ffmpeg .*gsa-news-2026-09-01-v2/ && $0 !~ /rtmp:\/\/a\.rtmp\.youtube\.com/ {print $1}')
echo "render_pids=$(echo $pids)"
for pid in $pids; do sudo kill -TERM "$pid" || true; done
sleep 3
for pid in $pids; do sudo kill -0 "$pid" 2>/dev/null && sudo kill -KILL "$pid" || true; done
echo 'LOAD_AFTER'; uptime
echo 'LIVE_ENCODERS'; sudo ps -eo pid=,ni=,%cpu=,%mem=,cmd= | grep -E '[f]fmpeg .*rtmp://a\.rtmp\.youtube\.com/live2/'
`;
const r=await runSshScript(remote,30000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
