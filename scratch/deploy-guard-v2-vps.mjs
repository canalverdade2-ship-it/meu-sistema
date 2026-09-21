import { runSshScript } from './ssh2-run.mjs';
const source = String.raw`#!/usr/bin/env python3
import fcntl, os, re, signal, subprocess, sys, syslog, time
lock = open("/run/gsa-rtmp-owner-guard.lock", "w")
try:
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
except BlockingIOError:
    sys.exit(0)
try:
    engine_id = subprocess.check_output(["docker", "inspect", "-f", "{{.Id}}", "gsa-tv-encoder-engine"], text=True).strip()
except Exception:
    syslog.openlog("gsa-rtmp-guard")
    syslog.syslog(syslog.LOG_ERR, "encoder engine container missing")
    sys.exit(1)
pattern = re.compile(rb"rtmps?://[^\x00 ]*\.rtmp\.youtube\.com(?::\d+)?/(?:live2|rtmp)/", re.I)
publishers = []
for name in os.listdir("/proc"):
    if not name.isdigit():
        continue
    pid = int(name)
    try:
        cmd = open(f"/proc/{pid}/cmdline", "rb").read()
        if not pattern.search(cmd):
            continue
        cgroup = open(f"/proc/{pid}/cgroup", errors="replace").read()
        start_ticks = int(open(f"/proc/{pid}/stat").read().split()[21])
        publishers.append((start_ticks, pid, engine_id in cgroup, cmd))
    except (FileNotFoundError, ProcessLookupError, PermissionError, IndexError, ValueError):
        continue
authorized = sorted(p for p in publishers if p[2])
keep_pid = authorized[0][1] if authorized else None
for _, pid, allowed, cmd in publishers:
    if allowed and pid == keep_pid:
        continue
    try:
        os.kill(pid, signal.SIGTERM)
    except ProcessLookupError:
        pass
    safe = re.sub(rb"(live2|rtmp)/[^\x00 ]+", lambda m: m.group(1) + b"/[REDACTED]", cmd)
    safe = safe[:500].decode(errors="replace").replace(chr(0), " ")
    level = "duplicate authorized" if allowed else "unauthorized"
    syslog.openlog("gsa-rtmp-guard")
    syslog.syslog(syslog.LOG_CRIT, f"{level} RTMP publisher killed pid={pid} cmd={safe}")
time.sleep(0.5)
for _, pid, allowed, _ in publishers:
    if allowed and pid == keep_pid:
        continue
    try:
        os.kill(pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
if len(publishers) > 1:
    sys.exit(2)
`;
const b64 = Buffer.from(source).toString('base64');
const r = await runSshScript(`set -euo pipefail
echo '${b64}' | base64 -d | sudo tee /usr/local/sbin/gsa-rtmp-single-owner-guard >/dev/null
sudo chmod 0755 /usr/local/sbin/gsa-rtmp-single-owner-guard
sudo python3 -m py_compile /usr/local/sbin/gsa-rtmp-single-owner-guard
sudo systemctl reset-failed gsa-rtmp-single-owner-guard.service || true
sudo systemctl restart gsa-rtmp-single-owner-guard.timer
sudo bash -c 'exec -a "rogue-publisher rtmps://b.rtmp.youtube.com/live2/FAKE-NO-CONNECTION" sleep 60' &
ROGUE=$!
sleep 7
if kill -0 "$ROGUE" 2>/dev/null; then kill -9 "$ROGUE" || true; echo ROGUE_GUARD_FAIL; exit 1; fi
echo ROGUE_GUARD_PASS
systemctl is-active gsa-rtmp-single-owner-guard.timer
journalctl -t gsa-rtmp-guard --since '-2 minutes' --no-pager | tail -n 5 | sed -E 's#((live2|rtmp)/)[^ ]+#\\1[REDACTED]#g'
`, 120000);
process.stdout.write(r.stdout); if (r.stderr) process.stderr.write(r.stderr);
