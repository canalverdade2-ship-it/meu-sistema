import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
sudo python3 - <<'PY'
from pathlib import Path
p=Path('/usr/local/sbin/gsa-rtmp-single-owner-guard')
s=p.read_text()
s=s.replace('import fcntl, os, re, signal, subprocess, sys, time','import fcntl, os, re, signal, subprocess, sys, syslog, time')
old='''    safe = re.sub(rb"(live2|rtmp)/[^\\x00 ]+", lambda m: m.group(1)+b"/[REDACTED]", cmd.replace(b"\\x00",b" "))[:500].decode(errors="replace")
    level = "duplicate authorized" if allowed else "unauthorized"
    subprocess.run(["logger","-p","daemon.crit","-t","gsa-rtmp-guard",f"{level} RTMP publisher killed pid={pid} cmd={safe}"])
    try: os.kill(pid, signal.SIGTERM)
    except ProcessLookupError: pass'''
new='''    safe = re.sub(rb"(live2|rtmp)/[^\\x00 ]+", lambda m: m.group(1)+b"/[REDACTED]", cmd)[:500].decode(errors="replace").replace(chr(0)," ")
    level = "duplicate authorized" if allowed else "unauthorized"
    try: os.kill(pid, signal.SIGTERM)
    except ProcessLookupError: pass
    syslog.openlog("gsa-rtmp-guard")
    syslog.syslog(syslog.LOG_CRIT, f"{level} RTMP publisher killed pid={pid} cmd={safe}")'''
if old not in s: raise SystemExit('target block not found')
p.write_text(s.replace(old,new))
PY
sudo python3 -m py_compile /usr/local/sbin/gsa-rtmp-single-owner-guard
sudo systemctl reset-failed gsa-rtmp-single-owner-guard.service || true
sudo systemctl restart gsa-rtmp-single-owner-guard.timer
sudo bash -c 'exec -a "rogue-publisher rtmps://b.rtmp.youtube.com/live2/FAKE-NO-CONNECTION" sleep 60' &
ROGUE=$!
sleep 7
if kill -0 "$ROGUE" 2>/dev/null; then kill -9 "$ROGUE" || true; echo ROGUE_GUARD_FAIL; exit 1; fi
echo ROGUE_GUARD_PASS
systemctl is-active gsa-rtmp-single-owner-guard.timer
journalctl -t gsa-rtmp-guard --since '-2 minutes' --no-pager | tail -n 10 | sed -E 's#((live2|rtmp)/)[^ ]+#\\1[REDACTED]#g'
`,120000); process.stdout.write(r.stdout); if(r.stderr)process.stderr.write(r.stderr);
