import { runSshScript } from './ssh2-run.mjs';

const script = `
echo "Waiting 35 seconds for the timer to trigger..."
sleep 35

echo "=== TIMER STATUS ==="
sudo systemctl status gsa-process-guardian.timer --no-pager

echo "=== SERVICE STATUS ==="
sudo systemctl status gsa-process-guardian.service --no-pager || true

echo "=== LOG FILE /var/log/gsa-process-guardian.log ==="
cat /var/log/gsa-process-guardian.log
`;

const res = await runSshScript(script);
console.log(res.stdout);
if (res.stderr) console.error("STDERR:", res.stderr);
