import { runSshScript } from './ssh2-run.mjs';

const script = String.raw`set -euo pipefail
work=/opt/gsa-tv/control-plane
stamp=$(date +%Y%m%d%H%M%S)
sudo cp "$work/src/app.js" "$work/src/app.js.before-1.6.39-$stamp"
cid=$(sudo docker create gsa-tv/control-plane:1.6.38)
trap 'sudo docker rm -f "$cid" >/dev/null 2>&1 || true' EXIT
sudo docker cp "$cid:/app/src/app.js" /tmp/gsa-tv-app-1639.js
sudo install -o root -g root -m 0644 /tmp/gsa-tv-app-1639.js "$work/src/app.js"

sudo python3 - <<'PY'
from pathlib import Path
p=Path('/opt/gsa-tv/control-plane/src/app.js')
s=p.read_text()

# Fix the scope regression that made the ZMQ tail call use an undefined helper.
old='''  let current = "v0";
  let label = 0;
  let inputIndex = 1;
  const font = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";
  for (const layer of layers) {
    const next = () => \`v\${++label}\`;'''
new='''  let current = "v0";
  let label = 0;
  let inputIndex = 1;
  const next = () => \`v\${++label}\`;
  const font = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";
  for (const layer of layers) {'''
if old in s:
    s=s.replace(old,new,1)
else:
    assert s.count('const next = () =>') == 1, 'graphics helper scope block not found'

# Preserve the exact desired/mode pair before attempting recovery. In particular,
# media:<id> must never silently fall back to program after maintenance.
old='''    const desired = result.rows[0]?.desired_state || "stopped";
    const mode = String(result.rows[0]?.playout_state || "program");
    if (desired === "running")
      await startStream(
        mode.startsWith("live:") || mode.startsWith("manual-live:")
          ? mode
          : "program",
        true,
      );'''
new='''    const desired = result.rows[0]?.desired_state || "stopped";
    const mode = String(result.rows[0]?.playout_state || "program");
    streamState.desired = desired;
    streamState.mode = mode;
    streamState.actual = desired === "stopped" ? "stopped" : "recovering";
    if (desired === "running")
      await startStream(
        mode.startsWith("live:") || mode.startsWith("manual-live:") || mode.startsWith("media:")
          ? mode
          : "program",
        true,
      );'''
assert old in s, 'runtime restore block not found'
s=s.replace(old,new,1)

# A candidate can be syntax/health tested without touching the production encoder.
old='''void restoreRuntime()
  .then(() => heartbeat())
  .catch(() => {});'''
new='''if (process.env.GSA_TV_DISABLE_RUNTIME_RESTORE !== "true") {
  void restoreRuntime()
    .then(() => heartbeat())
    .catch(() => {});
} else {
  log("warn", "runtime_restore_disabled", { reason: "safe_candidate_validation" });
}'''
assert old in s, 'startup restore call not found'
s=s.replace(old,new,1)
p.write_text(s)
PY

sudo docker run --rm -v "$work/src:/check:ro" --entrypoint node gsa-tv/control-plane:1.6.38 --check /check/app.js
cd "$work"
sudo docker build -t gsa-tv/control-plane:1.6.39 . >/tmp/gsa-tv-build-1639.log
sudo docker run --rm --entrypoint node gsa-tv/control-plane:1.6.39 --check /app/src/app.js

sudo install -d -o root -g root -m 0755 /opt/gsa-tv/bin
sudo tee /opt/gsa-tv/bin/deploy-control-plane-safe.sh >/dev/null <<'SH'
#!/usr/bin/env bash
set -euo pipefail
target_image="\${1:-}"
if [[ ! "$target_image" =~ ^gsa-tv/control-plane:[A-Za-z0-9._-]+$ ]]; then
  echo 'Uso: deploy-control-plane-safe.sh gsa-tv/control-plane:<versao>' >&2
  exit 64
fi
dburl=$(docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
state=$(docker run --rm --network host postgres:15-alpine psql "$dburl" -X -qAt -F '|' -c "select desired_state,signal_state from public.gsa_tv_channels where id='ch-main'")
encoders=$(docker top gsa-tv-control-plane -eo args 2>/dev/null | grep -c '[f]fmpeg' || true)
if [[ "$state" == running\|sending || "$encoders" -gt 0 ]]; then
  echo "REFUSED: canal em transmissao ($state; encoders=$encoders). A troca do container encerraria o FFmpeg ativo." >&2
  echo 'Use uma janela off-air ou migre primeiro o encoder para um serviço independente.' >&2
  exit 75
fi
docker image inspect "$target_image" >/dev/null
echo "SAFE_TO_DEPLOY|$target_image|$state|encoders=$encoders"
SH
sudo chmod 0755 /opt/gsa-tv/bin/deploy-control-plane-safe.sh

echo "candidate|$(sudo docker image inspect gsa-tv/control-plane:1.6.39 --format '{{.Id}}|{{.Created}}')"
echo "syntax|PASS"
echo "restore_media_guard|$(sudo grep -c 'mode.startsWith("media:")' "$work/src/app.js")"
echo "zmq_scope_guard|$(sudo grep -c 'const next = () =>' "$work/src/app.js")"
echo "deploy_guard|$(sudo test -x /opt/gsa-tv/bin/deploy-control-plane-safe.sh && echo INSTALLED)"
sudo /opt/gsa-tv/bin/deploy-control-plane-safe.sh gsa-tv/control-plane:1.6.39 || rc=$?
echo "live_deploy_guard_result|\${rc:-0}"
echo "running_container|$(sudo docker inspect gsa-tv-control-plane --format '{{.Config.Image}}|{{.State.Status}}|{{.State.Health.Status}}')"
echo "encoder_count|$(sudo docker top gsa-tv-control-plane -eo args | grep -c '[f]fmpeg' || true)"
`;

const result = await runSshScript(script, 900000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
