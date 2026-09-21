import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -u
echo '=== restore and heartbeat code ==='
sudo grep -nE 'restoreRuntime|setInterval|heartbeat|serviceHealth|streamProcess|terminateRelay|acquireEncoderLock|ENCODER_ENGINE|/v1/(ensure|status|stop)' /opt/gsa-tv/control-plane/src/app.js | head -n 260
echo '=== watchdog actual targets and remediation ==='
sudo grep -nE 'HLS_URL|CONTROL_PLANE|FFPLAYOUT|ENGINE|restart|docker|incident|setInterval|auto' /opt/gsa-tv/watchdog/src/app.js | head -n 280
echo '=== engine concurrency and health semantics ==='
sudo grep -nE 'app\.(post|get)|/v1/(ensure|stop|status)|health|mutex|queue|desired|producer_running|outer_running|UDP_PORT' /opt/gsa-tv/encoder-engine/src/app.js | head -n 320
echo '=== backup schedule/results ==='
sudo systemctl status gsa-tv-backup.timer --no-pager -l 2>/dev/null | head -n 50 || true
sudo journalctl -u gsa-tv-backup.service --since '14 days ago' --no-pager -n 100 2>/dev/null | tail -n 100 || true
echo '=== single publisher guard state ==='
sudo systemctl status gsa-rtmp-single-owner-guard.timer --no-pager -l | head -n 50
sudo journalctl -u gsa-rtmp-single-owner-guard.service --since '2 days ago' --no-pager -n 80 | tail -n 80
echo '=== current RTMP publishers count (redacted) ==='
sudo python3 /usr/local/sbin/gsa-rtmp-single-owner-guard --check-only 2>&1 || true
echo '=== changelog metadata ==='
sudo stat -c '%U:%G %a %s %y %n' /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
sudo tail -n 50 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
`,240000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
