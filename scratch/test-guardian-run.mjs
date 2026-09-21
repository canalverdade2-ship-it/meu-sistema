import { runSshScript } from './ssh2-run.mjs';

const script = `
echo "=== RUN 1: INITIAL BASELINE ==="
sudo /opt/gsa-tv/bin/gsa-process-guardian.sh

echo "Waiting 6 seconds to test FPS delta calculation..."
sleep 6

echo "=== RUN 2: DELTA AND FPS CHECK ==="
sudo /opt/gsa-tv/bin/gsa-process-guardian.sh

echo "=== LOG CONTENT ==="
tail -n 10 /var/log/gsa-process-guardian.log
`;

const res = await runSshScript(script);
console.log(res.stdout);
if (res.stderr) console.error("STDERR:", res.stderr);
