import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
sudo docker ps -a --format '{{.Names}}|{{.Image}}|{{.Status}}'
echo '=== health ==='
curl -fsS http://127.0.0.1:9210/health; echo
echo '=== audio filter active ==='
sudo docker exec gsa-tv-encoder-engine sh -lc 'for f in /proc/[0-9]*/cmdline; do c=$(tr "\\0" " " <"$f" 2>/dev/null); case "$c" in *adeclick*) echo yes;; esac; done' | head -n 3
echo '=== rtmp count ==='
ps -eo pid=,args= | grep '[f]fmpeg' | grep 'rtmp://a.rtmp.youtube.com/live2/' | sed -E 's#(live2/)[^ ]+#\\1[REDACTED]#g'
echo '=== compose/image ==='
sudo grep 'image:' /opt/gsa-tv/control-plane/compose.yml
sudo docker inspect gsa-tv-control-plane --format '{{.Config.Image}} {{.State.Health.Status}}'
echo '=== helper ==='
sudo grep 'gsa-tv/control-plane:' /usr/local/bin/ffmpeg
`,120000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
