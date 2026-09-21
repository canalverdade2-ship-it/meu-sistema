import { runSshScript } from './ssh2-run.mjs';
const r = await runSshScript(`set -euo pipefail
STAMP=$(date +%Y%m%d%H%M%S)
ARCH=/opt/gsa-tv/audit-archive/single-owner-$STAMP
sudo mkdir -p "$ARCH"
sudo chmod 0700 "$ARCH"

# Move stale source snapshots out of every Docker build context.
sudo find /opt/gsa-tv/control-plane/src -maxdepth 1 -type f \\( -name '*.bak*' -o -name '*.pre-single-owner-*' \\) -exec mv -t "$ARCH" {} +
if [ -d /opt/gsa-tv/build/control-plane-1.7.3 ]; then sudo mv /opt/gsa-tv/build/control-plane-1.7.3 "$ARCH/"; fi
if [ -f /opt/gsa-tv/control-plane/bin/encoder-client.js.disabled-legacy-* ]; then sudo mv /opt/gsa-tv/control-plane/bin/encoder-client.js.disabled-legacy-* "$ARCH/"; fi

# Remove stopped legacy containers and vulnerable image tags so they cannot be started by mistake.
for c in gsa-tv-control-plane-backup-1.7.2 gsa-tv-control-plane-backup-1.7.3; do
  [ -z "$(sudo docker ps -aq -f name=^/$c$)" ] || sudo docker rm "$c" >/dev/null
done
for img in gsa-tv/control-plane:1.7.0 gsa-tv/control-plane:1.7.1 gsa-tv/control-plane:1.7.2 gsa-tv/control-plane:1.7.3; do
  sudo docker image inspect "$img" >/dev/null 2>&1 && sudo docker image rm "$img" >/dev/null || true
done

# Replace guard with a /proc-wide detector for every YouTube RTMP/RTMPS publisher command.
sudo tee /usr/local/sbin/gsa-rtmp-single-owner-guard >/dev/null <<'GUARD'
#!/usr/bin/env python3
import fcntl, os, re, signal, subprocess, sys, time
lock = open("/run/gsa-rtmp-owner-guard.lock", "w")
try: fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
except BlockingIOError: sys.exit(0)
try:
    engine_id = subprocess.check_output(["docker","inspect","-f","{{.Id}}","gsa-tv-encoder-engine"], text=True).strip()
except Exception:
    subprocess.run(["logger","-p","daemon.err","-t","gsa-rtmp-guard","encoder engine container missing"])
    sys.exit(1)
pattern = re.compile(rb"rtmps?://[^\x00 ]*\.rtmp\.youtube\.com(?::\d+)?/(?:live2|rtmp)/", re.I)
publishers = []
for name in os.listdir("/proc"):
    if not name.isdigit(): continue
    pid = int(name)
    try:
        cmd = open(f"/proc/{pid}/cmdline","rb").read()
        if not pattern.search(cmd): continue
        cgroup = open(f"/proc/{pid}/cgroup", errors="replace").read()
        stat = open(f"/proc/{pid}/stat").read().split()
        publishers.append((int(stat[21]), pid, engine_id in cgroup, cmd))
    except (FileNotFoundError, ProcessLookupError, PermissionError, IndexError, ValueError):
        continue
authorized = sorted((p for p in publishers if p[2]))
keep_pid = authorized[0][1] if authorized else None
for _, pid, allowed, cmd in publishers:
    if allowed and pid == keep_pid: continue
    safe = re.sub(rb"(live2|rtmp)/[^\x00 ]+", lambda m: m.group(1)+b"/[REDACTED]", cmd.replace(b"\x00",b" "))[:500].decode(errors="replace")
    level = "duplicate authorized" if allowed else "unauthorized"
    subprocess.run(["logger","-p","daemon.crit","-t","gsa-rtmp-guard",f"{level} RTMP publisher killed pid={pid} cmd={safe}"])
    try: os.kill(pid, signal.SIGTERM)
    except ProcessLookupError: pass
time.sleep(0.5)
for _, pid, allowed, _ in publishers:
    if allowed and pid == keep_pid: continue
    try: os.kill(pid, signal.SIGKILL)
    except ProcessLookupError: pass
if len(publishers) > 1: sys.exit(2)
GUARD
sudo chmod 0755 /usr/local/sbin/gsa-rtmp-single-owner-guard
sudo systemctl daemon-reload
sudo systemctl restart gsa-rtmp-single-owner-guard.timer

# Clean canonical rebuild and verify no legacy launcher/content enters it.
sudo docker build --no-cache -q -t gsa-tv/control-plane:1.7.4-canonical-check /opt/gsa-tv/control-plane >/dev/null
sudo docker run --rm --entrypoint sh gsa-tv/control-plane:1.7.4-canonical-check -lc '! find /app -type f | grep -q encoder-client && ! grep -Rqs "spawn(\\\"/app/bin/encoder-client.js\\\"" /app'

# Intruder simulation uses RTMPS, a different YouTube ingest hostname, and no ffmpeg process name.
sudo bash -c 'exec -a "rogue-publisher rtmps://b.rtmp.youtube.com/live2/FAKE-NO-CONNECTION" sleep 60' &
ROGUE=$!
sleep 7
if kill -0 "$ROGUE" 2>/dev/null; then kill -9 "$ROGUE" || true; echo ROGUE_GUARD_FAIL; exit 1; fi

COUNT=$(python3 - <<'PY'
import os,re
p=re.compile(rb"rtmps?://[^\x00 ]*\.rtmp\.youtube\.com(?::\d+)?/(?:live2|rtmp)/",re.I)
n=0
for x in os.listdir('/proc'):
  if x.isdigit():
    try: n += bool(p.search(open('/proc/'+x+'/cmdline','rb').read()))
    except: pass
print(n)
PY
)
test "$COUNT" -eq 1
echo "publishers=$COUNT"
echo "archive=$ARCH"
echo "guard=$(systemctl is-active gsa-rtmp-single-owner-guard.timer)"
echo 'remaining_control_images:'
sudo docker image ls gsa-tv/control-plane --format '{{.Repository}}:{{.Tag}}'
echo HARDENING_PASS
`,300000);
process.stdout.write(r.stdout); if(r.stderr) process.stderr.write(r.stderr);
