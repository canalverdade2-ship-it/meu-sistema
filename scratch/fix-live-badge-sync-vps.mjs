import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
SRC=/opt/gsa-tv/control-plane/src/app.js
sudo cp -a "$SRC" /opt/gsa-tv/audit-archive/app.js.pre-engine-badge-sync-$(date +%Y%m%d%H%M%S)

# Correct the current visual state immediately, without restarting producer or RTMP.
printf ' ' | sudo tee /opt/gsa-tv/runtime/gsa-tv-live-badge.txt >/dev/null
sudo docker exec -i gsa-tv-control-plane python3 - <<'PY'
import zmq
ctx=zmq.Context(); s=ctx.socket(zmq.REQ); s.setsockopt(zmq.LINGER,0)
s.connect('tcp://127.0.0.1:5577')
for c in ('drawbox@live_badge_box color 0x000000@0.00','drawbox@live_badge_box width 0','drawbox@live_badge_box height 0'):
    s.send_string(c); reply=s.recv_string()
    if not reply.startswith('0 '): raise SystemExit(reply)
PY

sudo python3 - <<'PY'
from pathlib import Path
p=Path('/opt/gsa-tv/control-plane/src/app.js'); s=p.read_text()
old='''async function applyGraphicsRuntime() {
  if (!streamProcess || streamProcess.exitCode !== null || streamProcess.killed)
    return { applied: false, reason: "encoder_not_running" };'''
new='''async function applyGraphicsRuntime() {
  let engineState;
  try {
    engineState = await encoderEngineRequest("/v1/status", "GET");
  } catch (error) {
    return { applied: false, reason: "encoder_engine_unavailable", error: error.message };
  }
  if (!engineState?.producer_running)
    return { applied: false, reason: "encoder_not_running" };'''
if old not in s: raise SystemExit('legacy runtime guard not found')
s=s.replace(old,new,1)
old2='''  await persistStreamState();
  log("info", "stream_ensured_by_encoder_engine", {'''
new2='''  await persistStreamState();
  await new Promise((resolve) => setTimeout(resolve, 500));
  const graphicsSync = await applyGraphicsRuntime().catch((error) => ({ applied: false, error: error.message }));
  log("info", "stream_ensured_by_encoder_engine", {'''
if old2 not in s: raise SystemExit('post ensure anchor not found')
s=s.replace(old2,new2,1)
s=s.replace('''    producer_restarted: Boolean(engineState.producer_restarted),
  });''','''    producer_restarted: Boolean(engineState.producer_restarted),
    graphics_sync: graphicsSync,
  });''',1)
p.write_text(s)
PY
node --check "$SRC"
sudo docker build --no-cache -q -t gsa-tv/control-plane:1.7.8 /opt/gsa-tv/control-plane >/dev/null
sudo sed -i 's|image: gsa-tv/control-plane:1.7.7|image: gsa-tv/control-plane:1.7.8|' /opt/gsa-tv/control-plane/compose.yml
OUTER=$(ps -eo pid=,args= | grep '[f]fmpeg' | grep 'rtmp://a.rtmp.youtube.com/live2/' | awk 'NR==1{print $1}')
cd /opt/gsa-tv/control-plane
sudo docker compose up -d --no-build
for i in $(seq 1 30); do [ "$(sudo docker inspect gsa-tv-control-plane --format '{{.State.Health.Status}}' 2>/dev/null || true)" = healthy ] && break; sleep 1; done
test "$(sudo docker inspect gsa-tv-control-plane --format '{{.State.Health.Status}}')" = healthy
test "$OUTER" = "$(ps -eo pid=,args= | grep '[f]fmpeg' | grep 'rtmp://a.rtmp.youtube.com/live2/' | awk 'NR==1{print $1}')"
sudo sed -i 's|gsa-tv/control-plane:1.7.7|gsa-tv/control-plane:1.7.8|' /usr/local/bin/ffmpeg
sudo docker image rm gsa-tv/control-plane:1.7.7 >/dev/null 2>&1 || true
echo "outer_pid_preserved=$OUTER"
echo BADGE_SYNC_DEPLOYED
`,360000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
