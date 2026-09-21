import { runSshScript } from './ssh2-run.mjs';
const r = await runSshScript(`set -euo pipefail
echo '=== processes ==='
ps -eo pid=,ppid=,lstart=,args= | grep '[f]fmpeg' | grep 'rtmp://a.rtmp.youtube.com/live2/' | sed -E 's#(rtmp://[^/]+/live2/)[^ ]+#\\1[REDACTED]#g' || true
echo '=== all containers ==='
sudo docker ps -a --format '{{.Names}}|{{.Image}}|{{.Status}}'
echo '=== restart policies ==='
for c in $(sudo docker ps -aq); do sudo docker inspect "$c" --format '{{.Name}}|{{.Config.Image}}|restart={{.HostConfig.RestartPolicy.Name}}|state={{.State.Status}}'; done
echo '=== images containing legacy launcher or RTMP literals ==='
for img in $(sudo docker image ls --format '{{.Repository}}:{{.Tag}}' | grep '^gsa-tv/' | sort -u); do
  out=$(sudo docker run --rm --entrypoint sh "$img" -lc 'find /app /opt -type f 2>/dev/null | while read f; do grep -IlE "encoder-client\\.js|a\\.rtmp\\.youtube" "$f" 2>/dev/null; done' 2>/dev/null || true)
  [ -z "$out" ] || { echo "IMAGE=$img"; echo "$out"; }
done
echo '=== active and canonical start code ==='
sudo docker exec gsa-tv-control-plane sh -lc "grep -nE 'spawn\\(|/v1/ensure|encoder-client' /app/src/app.js | tail -n 30"
sudo grep -nE 'spawn\\(|/v1/ensure|encoder-client' /opt/gsa-tv/control-plane/src/app.js | tail -n 30
echo '=== executable legacy files ==='
sudo find /opt/gsa-tv /home/opc/gsa-ai -type f -perm /111 -not -path '*/node_modules/*' -print0 2>/dev/null | sudo xargs -0 grep -IlE 'encoder-client\\.js|a\\.rtmp\\.youtube' 2>/dev/null || true
echo '=== systemd and cron references ==='
sudo find /etc/systemd /etc/cron.d /var/spool/cron /opt/gsa-tv -type f -not -path '*/node_modules/*' -not -path '/opt/gsa-tv/cache/*' -print0 2>/dev/null | sudo xargs -0 grep -IlE 'docker (start|restart|run).*control-plane|encoder-client\\.js|a\\.rtmp\\.youtube' 2>/dev/null || true
echo '=== compose files ==='
sudo find /opt/gsa-tv /home/opc/gsa-ai -type f \\( -name 'compose*.yml' -o -name 'compose*.yaml' -o -name 'docker-compose*.yml' -o -name 'docker-compose*.yaml' \\) -print0 2>/dev/null | while IFS= read -r -d '' f; do echo "--- $f"; sudo grep -nE 'image:|container_name:|restart:|control-plane|encoder-engine' "$f" || true; done
echo '=== timers/services ==='
systemctl list-timers --all --no-pager | grep -Ei 'gsa|rtmp|encoder' || true
systemctl list-unit-files --type=service --no-pager | grep -Ei 'gsa|rtmp|encoder' || true
echo '=== guard source ==='
sudo sed -n '1,240p' /usr/local/sbin/gsa-rtmp-single-owner-guard
echo '=== engine lock/start paths ==='
sudo docker exec gsa-tv-encoder-engine sh -lc "grep -RniE 'advisory|spawn\\(|rtmp|/v1/ensure' /app --exclude-dir=node_modules | head -n 160" | sed -E 's#(rtmp://[^/]+/live2/)[^ "'\"']+#\\1[REDACTED]#g'
echo '=== health ==='
curl -fsS http://127.0.0.1:9210/health | sed -E 's#(rtmp://[^/]+/live2/)[^" ]+#\\1[REDACTED]#g'; echo
`,300000);
process.stdout.write(r.stdout); if(r.stderr) process.stderr.write(r.stderr);
