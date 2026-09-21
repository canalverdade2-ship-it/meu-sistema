import { runSshScript } from './ssh2-run.mjs';

const cmd = `
echo '=== 1. TIMERS AND SERVICES ==='
systemctl list-timers | grep -E "gsa-tv|ACTIVATES" || true
echo '--- gsa-tv-night-factory.service ---'
cat /etc/systemd/system/gsa-tv-night-factory.service 2>/dev/null || echo 'service not found'
echo '--- gsa-tv-night-factory.timer ---'
cat /etc/systemd/system/gsa-tv-night-factory.timer 2>/dev/null || echo 'timer not found'
echo '--- gsa-tv-night-stop.timer ---'
cat /etc/systemd/system/gsa-tv-night-stop.timer 2>/dev/null || echo 'night-stop timer not found'
echo '--- gsa-tv-night-stop.service ---'
cat /etc/systemd/system/gsa-tv-night-stop.service 2>/dev/null || echo 'night-stop service not found'

echo '=== 2. NIGHT CONTROLLER SCRIPT ==='
cat /opt/gsa-tv/bin/gsa-tv-night-controller.sh 2>/dev/null || echo 'night-controller not found'

echo '=== 3. LIVE STREAM HEALTH ==='
ss -tulpn | grep 1935 || true
ss -tnp | grep 1935 || true
curl -s http://127.0.0.1:9202/encoder/status || true
echo ""
curl -s http://127.0.0.1:9202/health || true
echo ""

echo '=== 4. RECENT NIGHT FACTORY LOG ==='
tail -n 35 /var/log/gsa-tv-night-factory.log 2>/dev/null || echo 'no log'
`;

try {
  const res = await runSshScript(cmd, 60000);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
} catch (e) {
  console.error('ERROR:', e);
}
