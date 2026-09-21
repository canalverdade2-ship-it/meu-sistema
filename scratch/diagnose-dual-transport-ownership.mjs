import {runSshScript} from './ssh2-run.mjs';
const sh=String.raw`set -euo pipefail
echo '=== PID OWNERSHIP ==='
for p in $(pgrep -f 'ffmpeg.*12345' || true); do echo "--- PID $p"; ps -o pid,ppid,user,lstart,cmd -p "$p"; pp=$(ps -o ppid= -p "$p"|tr -d ' '); ps -o pid,ppid,user,lstart,cmd -p "$pp"; cat "/proc/$p/cgroup" 2>/dev/null || true; done
echo '=== UDP 12345 ==='
sudo ss -lunp | grep ':12345' || true
echo '=== RELATED UNITS ==='
systemctl list-units --type=service --all --no-pager | grep -Ei 'gsa|encoder|rtmp|forward' || true
echo '=== UNIT FILE SEARCH ==='
sudo grep -RIlE '12345|a\.rtmp\.youtube' /etc/systemd/system /opt/gsa-tv 2>/dev/null | head -80 || true
`;
const r=await runSshScript(sh,60000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
