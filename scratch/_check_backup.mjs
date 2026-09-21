import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript("sudo grep -n 'DB_URL=' /opt/gsa-tv/backup/gsa-tv-backup-full.sh\n",30000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);

