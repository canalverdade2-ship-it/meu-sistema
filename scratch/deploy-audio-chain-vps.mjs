import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
OLD='aresample=async=1000'
NEW='aresample=async=1000:first_pts=0,highpass=f=45,lowpass=f=15500,equalizer=f=4500:t=q:w=0.8:g=-2.5,adeclick=w=55:o=75:a=2:t=2:b=2,alimiter=limit=0.82:attack=5:release=50:level=false'
sudo cp -a /opt/gsa-tv/control-plane/src/app.js /opt/gsa-tv/audit-archive/app.js.pre-audio-chain-$(date +%Y%m%d%H%M%S)
sudo python3 - <<PY
from pathlib import Path
p=Path('/opt/gsa-tv/control-plane/src/app.js')
s=p.read_text()
old='"$OLD"'
new='"$NEW"'
if old not in s: raise SystemExit('old audio filter not found')
p.write_text(s.replace(old,new))
PY
node --check /opt/gsa-tv/control-plane/src/app.js
sudo docker build --no-cache -q -t gsa-tv/control-plane:1.7.6 /opt/gsa-tv/control-plane >/dev/null
sudo sed -i 's|image: gsa-tv/control-plane:1.7.5|image: gsa-tv/control-plane:1.7.6|' /opt/gsa-tv/control-plane/compose.yml
OUTER_BEFORE=$(ps -eo pid=,args= | grep '[f]fmpeg' | grep 'rtmp://a.rtmp.youtube.com/live2/' | awk 'NR==1{print $1}')
sudo docker stop gsa-tv-control-plane >/dev/null
sudo docker rename gsa-tv-control-plane gsa-tv-control-plane-retired-1.7.5
if ! (cd /opt/gsa-tv/control-plane && sudo docker compose up -d --no-build); then
  sudo docker rm -f gsa-tv-control-plane 2>/dev/null || true
  sudo docker rename gsa-tv-control-plane-retired-1.7.5 gsa-tv-control-plane
  sudo docker start gsa-tv-control-plane >/dev/null
  exit 1
fi
for i in $(seq 1 30); do [ "$(sudo docker inspect gsa-tv-control-plane --format '{{.State.Health.Status}}' 2>/dev/null || true)" = healthy ] && break; sleep 1; done
test "$(sudo docker inspect gsa-tv-control-plane --format '{{.State.Health.Status}}')" = healthy

# Ask the Engine to swap only the producer using the protected current desired state.
TOKEN=$(sudo docker inspect gsa-tv-encoder-engine --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="ENCODER_ENGINE_TOKEN"{sub(/^ENCODER_ENGINE_TOKEN=/,"");print;exit}')
sudo python3 - <<PY >/tmp/gsa-audio-ensure.json
import json
p='/opt/gsa-tv/runtime/encoder-state.json'
d=json.load(open(p))
a=d['args']
for i,x in enumerate(a):
    if x=='-af':
        a[i+1]='$NEW'
d['args']=a
print(json.dumps({'args':a,'mode':d.get('mode','program')}))
PY
curl -fsS -X POST http://127.0.0.1:9210/v1/ensure -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' --data-binary @/tmp/gsa-audio-ensure.json >/tmp/gsa-audio-ensure-result.json
rm -f /tmp/gsa-audio-ensure.json
sleep 5
OUTER_AFTER=$(ps -eo pid=,args= | grep '[f]fmpeg' | grep 'rtmp://a.rtmp.youtube.com/live2/' | awk 'NR==1{print $1}')
test "$OUTER_BEFORE" = "$OUTER_AFTER"
COUNT=$(ps -eo args= | grep '[f]fmpeg' | grep -c 'rtmp://a.rtmp.youtube.com/live2/' || true)
test "$COUNT" -eq 1
curl -fsS http://127.0.0.1:9210/health | grep -q '"last_error":null'
sudo docker exec gsa-tv-encoder-engine sh -lc 'for f in /proc/[0-9]*/cmdline; do tr "\\0" " " <"$f" 2>/dev/null; echo; done' | grep -q 'adeclick=w=55'

# Repair the administrative ffmpeg helper that still referenced removed 1.7.2.
sudo sed -i 's|gsa-tv/control-plane:1.7.2|gsa-tv/control-plane:1.7.6|' /usr/local/bin/ffmpeg
sudo docker rm gsa-tv-control-plane-retired-1.7.5 >/dev/null
sudo docker image rm gsa-tv/control-plane:1.7.5 >/dev/null 2>&1 || true
rm -f /tmp/gsa-audio-ensure-result.json
echo "control_image=gsa-tv/control-plane:1.7.6"
echo "outer_pid_preserved=$OUTER_AFTER"
echo "publishers=$COUNT"
echo AUDIO_CHAIN_DEPLOYED
`,360000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
