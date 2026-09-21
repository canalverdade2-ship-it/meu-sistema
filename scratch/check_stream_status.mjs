import { runSshScript } from './ssh2-run.mjs';

const cmd = `
echo "=== STREAM FFMPEG PROCESSES ==="
ps aux | grep -E 'ffmpeg|ffplayout' | grep -v grep

echo "=== SYSTEMD JOURNAL FOR STREAM / WATCHDOG ==="
docker logs --tail 20 gsa-tv-encoder-engine
echo "--- WATCHDOG LOGS ---"
docker logs --tail 20 gsa-tv-watchdog
`;

const res = await runSshScript(cmd, 30000);
console.log(res.stdout);
