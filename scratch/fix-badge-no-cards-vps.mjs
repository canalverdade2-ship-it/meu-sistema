import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
SRC=/opt/gsa-tv/control-plane/src/app.js
sudo cp -a "$SRC" /opt/gsa-tv/audit-archive/app.js.pre-badge-command-fix-$(date +%Y%m%d%H%M%S)
sudo python3 - <<'PY'
from pathlib import Path
p=Path('/opt/gsa-tv/control-plane/src/app.js'); s=p.read_text()
old='''  if (!cards) return { applied: true, cards: 0, commands: 0 };
  const replies = await sendGraphicsCommands(commands);
  return { applied: true, cards, commands: replies.length, transport_restarted: false };'''
new='''  const replies = commands.length ? await sendGraphicsCommands(commands) : [];
  return { applied: true, cards, commands: replies.length, transport_restarted: false };'''
if old not in s: raise SystemExit('badge early-return block missing')
p.write_text(s.replace(old,new,1))
PY
node --check "$SRC"
sudo docker build --no-cache -q -t gsa-tv/control-plane:1.7.9 /opt/gsa-tv/control-plane >/dev/null
sudo sed -i 's|image: gsa-tv/control-plane:1.7.8|image: gsa-tv/control-plane:1.7.9|' /opt/gsa-tv/control-plane/compose.yml
OUTER=$(ps -eo pid=,args= | grep '[f]fmpeg' | grep 'rtmp://a.rtmp.youtube.com/live2/' | awk 'NR==1{print $1}')
cd /opt/gsa-tv/control-plane
sudo docker compose up -d --no-build
for i in $(seq 1 30); do [ "$(sudo docker inspect gsa-tv-control-plane --format '{{.State.Health.Status}}' 2>/dev/null || true)" = healthy ] && break; sleep 1; done
test "$(sudo docker inspect gsa-tv-control-plane --format '{{.State.Health.Status}}')" = healthy
test "$OUTER" = "$(ps -eo pid=,args= | grep '[f]fmpeg' | grep 'rtmp://a.rtmp.youtube.com/live2/' | awk 'NR==1{print $1}')"
sudo sed -i 's|gsa-tv/control-plane:1.7.8|gsa-tv/control-plane:1.7.9|' /usr/local/bin/ffmpeg
sudo docker image rm gsa-tv/control-plane:1.7.8 >/dev/null 2>&1 || true
echo BADGE_COMMAND_FIX_PASS
`,360000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
