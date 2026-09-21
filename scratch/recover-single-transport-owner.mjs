import {runSshScript} from './ssh2-run.mjs';
const sh=String.raw`set -euo pipefail
old=1941315
cpid=$(sudo docker inspect gsa-tv-control-plane --format '{{.Id}}')
test -r "/proc/$old/cgroup"
grep -q "$cpid" "/proc/$old/cgroup"
cmd=$(tr '\0' ' ' <"/proc/$old/cmdline")
printf '%s' "$cmd" | grep -q 'ffmpeg.*udp://127.0.0.1:12345'
printf '%s' "$cmd" | grep -q 'rtmp://a.rtmp.youtube.com'
echo "validated_orphan_pid=$old container=$cpid"
sudo kill -TERM "$old"
for i in $(seq 1 45); do
  udp=$(sudo ss -lunp 2>/dev/null | grep ':12345' || true)
  rtmp=$(sudo ss -tnp 2>/dev/null | grep ':1935' | grep ESTAB || true)
  status=$(curl -fsS -H "Authorization: Bearer $(sudo awk -F= '$1==\"ENCODER_ENGINE_TOKEN\"{print substr($0,index($0,\"=\")+1);exit}' /opt/gsa-tv/control-plane/.env)" http://127.0.0.1:9210/v1/status 2>/dev/null || true)
  if printf '%s' "$status"|grep -q '"outer_running":true' && printf '%s' "$status"|grep -q '"producer_running":true' && [ -n "$rtmp" ]; then break; fi
  sleep 1
done
echo '=== FINAL STATUS ==='
echo "$status"
echo '=== UDP OWNER ==='
echo "$udp"
echo '=== RTMP ==='
echo "$rtmp"
echo '=== PROCESSES ==='
pgrep -af 'ffmpeg.*(12345|rtmp)' || true
`;
const r=await runSshScript(sh,90000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
