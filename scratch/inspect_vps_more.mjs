import { runSshScript } from './ssh2-run.mjs';

const cmd = `
echo "=== DISK USAGE (DF -H) ==="
df -h / /opt/gsa-tv /boot

echo "=== MEMORY ==="
free -h

echo "=== STREAM SERVICES & PROCESSES ==="
systemctl list-units --all | grep -E 'gsa|ff|stream|nginx|rtmp' || true
ps aux | grep -E 'ffplayout|ffmpeg' | grep -v grep || true

echo "=== BACKUP SCRIPT FULL CONTENT ==="
sudo cat /opt/gsa-tv/backup/gsa-tv-backup-full.sh
`;

const res = await runSshScript(cmd, 60000);
console.log(res.stdout);
if (res.stderr) console.error("STDERR:", res.stderr);
