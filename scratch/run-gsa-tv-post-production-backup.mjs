import { runSshScript } from './ssh2-run.mjs';

const remote = String.raw`set -euo pipefail
sudo systemctl start gsa-tv-backup.service
sudo systemctl is-active gsa-tv-backup.timer
sudo systemctl --no-pager --full status gsa-tv-backup.service | sed -n '1,16p'
sudo find /opt/gsa-tv/backups/full -mindepth 1 -maxdepth 1 -type d -printf '%T@|%p\n' | sort -nr | head -1
`;

const result = await runSshScript(remote, 240000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
