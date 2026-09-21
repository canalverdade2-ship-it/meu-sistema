import { runSshScript } from './ssh2-run.mjs';

const cmd = `
echo "=== SERVICE STATUS ==="
systemctl is-active gsa-tv-backup.service || true
echo ""
echo "=== PROCESS TREE ==="
ps aux | grep -E 'gsa-tv-backup|pg_dump|tar|gzip|sqlite' | grep -v grep || true
echo ""
echo "=== RECENT JOURNAL ENTRIES ==="
sudo journalctl -u gsa-tv-backup.service -n 25 --no-pager
echo ""
echo "=== BACKUP DIRECTORY STATUS ==="
sudo ls -la /opt/gsa-tv/backups/full/
`;

const res = await runSshScript(cmd, 30000);
console.log(res.stdout);
