import fs from 'node:fs';
import {runSshScript} from './ssh2-run.mjs';
const b64=Buffer.from(fs.readFileSync('./infrastructure/gsa-tv/scripts/backup-full.sh')).toString('base64');
const r=await runSshScript(`printf '%s' '${b64}' | base64 -d > /tmp/gsa-tv-backup-full.sh
sudo install -m 0750 -o root -g root /tmp/gsa-tv-backup-full.sh /opt/gsa-tv/backup/gsa-tv-backup-full.sh
awk -F= '$1=="DATABASE_URL"{print "BACKUP_SCRIPT_PARSE_OK";exit}' /opt/gsa-tv/control-plane/.env
`,30000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);

