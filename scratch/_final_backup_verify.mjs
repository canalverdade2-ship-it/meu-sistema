import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`echo '=== CHECKSUM ==='
sudo bash -lc 'cd /opt/gsa-tv/backups/full/20260901T024432Z && sha256sum -c manifest.sha256'
echo '=== SIZE ==='
sudo du -sh /opt/gsa-tv/backups/full/20260901T024432Z
echo '=== TIMER ==='
systemctl is-enabled gsa-tv-backup.timer
systemctl is-active gsa-tv-backup.timer
systemctl list-timers --all gsa-tv-backup.timer --no-pager
`,30000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
