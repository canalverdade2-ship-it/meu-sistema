import {runSshScript} from './ssh2-run.mjs';
const remote=String.raw`set -euo pipefail
pids=$(sudo ps -eo pid=,cmd= | awk '/ffmpeg .*rtmp:\/\/a\.rtmp\.youtube\.com\/live2\// {print $1}')
count=$(printf '%s\n' "$pids" | sed '/^$/d' | wc -l)
echo "before=$count pids=$(echo $pids)"
if [ "$count" -gt 1 ]; then
  keep=$(printf '%s\n' "$pids" | sed '/^$/d' | tail -1)
  for pid in $pids; do [ "$pid" = "$keep" ] || sudo kill -TERM "$pid"; done
  sleep 4
  for pid in $pids; do [ "$pid" = "$keep" ] || { sudo kill -0 "$pid" 2>/dev/null && sudo kill -KILL "$pid" || true; }; done
  echo "kept=$keep"
fi
echo 'AFTER'
sudo ps -eo pid=,lstart=,cmd= | grep -E '[f]fmpeg .*rtmp://a\.rtmp\.youtube\.com/live2/'
`;
const r=await runSshScript(remote,30000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
