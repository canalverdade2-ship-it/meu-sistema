import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -u
echo '=== CONTAINER ID TO NAME/LOG ==='
for c in $(sudo docker ps -aq); do sudo docker inspect "$c" --format '{{.Id}}|{{.Name}}|{{.HostConfig.LogConfig.Type}}|{{json .HostConfig.LogConfig.Config}}|{{.State.Status}}|{{.RestartCount}}'; done | sort
echo '=== GSA TV ERRORS LAST 48H (URL/KEY REDACTED) ==='
for c in gsa-tv-control-plane gsa-tv-encoder-engine gsa-tv-watchdog gsa-tv-ffplayout; do
  echo "CONTAINER=$c"
  sudo docker logs --since 48h "$c" 2>&1 | grep -Ei 'error|fatal|failed|failure|exception|timeout|killed|oom|broken|invalid|reconnect|exit' | tail -n 180 | sed -E 's#(rtmps?://)[^ ]+#\\1[REDACTED]#g; s#(live2|rtmp)/[^ ]+#\\1/[REDACTED]#g' || true
done
echo '=== SERVICE FAILURES ==='
sudo systemctl --failed --no-pager || true
sudo journalctl -p err --since '48 hours ago' --no-pager -n 180 2>/dev/null | sed -E 's#(rtmps?://)[^ ]+#\\1[REDACTED]#g' || true
echo '=== DOCKER DISK/BUILD CACHE ==='
sudo docker system df -v | tail -n 100
echo '=== DIRECTORY USAGE ==='
sudo du -x -h --max-depth=2 /opt/gsa-tv 2>/dev/null | sort -h | tail -n 80
`,240000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
