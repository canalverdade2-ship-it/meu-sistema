import fs from 'node:fs';
import {runSshScript} from './ssh2-run.mjs';
const b64=Buffer.from(fs.readFileSync('./infrastructure/gsa-tv/scripts/backup-full.sh')).toString('base64');
const script=`printf '%s' '${b64}' | base64 -d > /tmp/gsa-tv-backup-full.sh
bash -n /tmp/gsa-tv-backup-full.sh
sudo install -m 0750 -o root -g root /tmp/gsa-tv-backup-full.sh /opt/gsa-tv/backup/gsa-tv-backup-full.sh
echo BACKUP_SCRIPT_V3_INSTALLED
`;
const r=await runSshScript(script,30000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);

