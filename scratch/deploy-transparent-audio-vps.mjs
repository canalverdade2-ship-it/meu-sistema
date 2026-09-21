import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
SRC=/opt/gsa-tv/control-plane/src/app.js
OLD='aresample=async=1000:first_pts=0,highpass=f=45,lowpass=f=15500,equalizer=f=4500:t=q:w=0.8:g=-2.5,adeclick=w=55:o=75:a=2:t=2:b=2,alimiter=limit=0.82:attack=5:release=50:level=false'
NEW='aresample=48000:async=1:min_hard_comp=0.100:first_pts=0,alimiter=limit=0.89:attack=5:release=50:level=false'
sudo cp -a "$SRC" /opt/gsa-tv/audit-archive/app.js.pre-transparent-audio-$(date +%Y%m%d%H%M%S)
sudo python3 - <<PY
from pathlib import Path
p=Path('$SRC'); s=p.read_text()
old='"$OLD"'; new='"$NEW"'
if old not in s: raise SystemExit('old live filter missing')
s=s.replace(old,new,1)
pos=s.index(new)
head=s[:pos]
bit=head.rfind('"128k"')
if bit < 0 or pos-bit > 300: raise SystemExit('live bitrate missing')
s=s[:bit]+'"192k"'+s[bit+6:]
p.write_text(s)
PY
node --check "$SRC"
sudo docker build --no-cache -q -t gsa-tv/control-plane:1.7.7 /opt/gsa-tv/control-plane >/dev/null
sudo sed -i 's|image: gsa-tv/control-plane:1.7.6|image: gsa-tv/control-plane:1.7.7|' /opt/gsa-tv/control-plane/compose.yml
cd /opt/gsa-tv/control-plane
sudo docker compose up -d --no-build
for i in $(seq 1 30); do [ "$(sudo docker inspect gsa-tv-control-plane --format '{{.State.Health.Status}}' 2>/dev/null || true)" = healthy ] && break; sleep 1; done
test "$(sudo docker inspect gsa-tv-control-plane --format '{{.State.Health.Status}}')" = healthy

TOKEN=$(sudo docker inspect gsa-tv-encoder-engine --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="ENCODER_ENGINE_TOKEN"{sub(/^ENCODER_ENGINE_TOKEN=/,"");print;exit}')
OUTER_BEFORE=$(ps -eo pid=,args= | grep '[f]fmpeg' | grep 'rtmp://a.rtmp.youtube.com/live2/' | awk 'NR==1{print $1}')
sudo python3 - <<PY >/tmp/gsa-transparent-audio.json
import json
d=json.load(open('/opt/gsa-tv/runtime/encoder-state.json')); a=d['args']
for i,x in enumerate(a):
  if x=='-af': a[i+1]='$NEW'
  if x=='-b:a': a[i+1]='192k'
print(json.dumps({'args':a,'mode':d.get('mode','program')}))
PY
curl -fsS -X POST http://127.0.0.1:9210/v1/ensure -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' --data-binary @/tmp/gsa-transparent-audio.json >/dev/null
rm -f /tmp/gsa-transparent-audio.json
sleep 7
OUTER_AFTER=$(ps -eo pid=,args= | grep '[f]fmpeg' | grep 'rtmp://a.rtmp.youtube.com/live2/' | awk 'NR==1{print $1}')
test "$OUTER_BEFORE" = "$OUTER_AFTER"
test "$(ps -eo args= | grep '[f]fmpeg' | grep -c 'rtmp://a.rtmp.youtube.com/live2/' || true)" -eq 1
curl -fsS http://127.0.0.1:9210/health | grep -q '"last_error":null'
sudo sed -i 's|gsa-tv/control-plane:1.7.6|gsa-tv/control-plane:1.7.7|' /usr/local/bin/ffmpeg
sudo docker image rm gsa-tv/control-plane:1.7.6 >/dev/null 2>&1 || true
echo "control=1.7.7"
echo "outer_pid_preserved=$OUTER_AFTER"
echo TRANSPARENT_AUDIO_LIVE
`,360000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
