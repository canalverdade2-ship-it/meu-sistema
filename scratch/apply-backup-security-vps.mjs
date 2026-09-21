import fs from 'node:fs';
import { runSshScript } from './ssh2-run.mjs';

const backup = fs.readFileSync(new URL('./gsa-tv-backup-full-fixed.sh', import.meta.url)).toString('base64');
const result = await runSshScript(`set -Eeuo pipefail
echo '${backup}' | base64 -d > /tmp/gsa-tv-backup-full.sh
sudo install -o root -g root -m 0750 /tmp/gsa-tv-backup-full.sh /opt/gsa-tv/backup/gsa-tv-backup-full.sh
rm -f /tmp/gsa-tv-backup-full.sh
sudo chmod 0600 /opt/gsa-tv/control-plane/secrets/ffplayout-admin-password /opt/gsa-tv/watchdog/secrets/ffplayout-admin-password
sudo find /opt/gsa-tv/cache/media -xdev -type d -perm -0002 -exec chmod o-w {} +
sudo find /opt/gsa-tv/cache/media -xdev -type f -perm -0002 -exec chmod o-w {} +
sudo /opt/gsa-tv/backup/gsa-tv-backup-full.sh
`, 900000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
