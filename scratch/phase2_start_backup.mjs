import { runSshScript } from './ssh2-run.mjs';

const cmd = String.raw`
set -euo pipefail

echo "=== STARTING GSA-TV-BACKUP SERVICE ==="
sudo systemctl reset-failed gsa-tv-backup.service || true
sudo systemctl start --no-block gsa-tv-backup.service

echo "=== SERVICE STATUS IMMEDIATELY ==="
systemctl status gsa-tv-backup.service --no-pager
`;

const res = await runSshScript(cmd, 30000);
console.log(res.stdout);
if (res.stderr) console.error("STDERR:", res.stderr);
