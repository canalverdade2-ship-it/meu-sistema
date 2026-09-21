import { runSshScript } from './ssh2-run.mjs';

const cmd = `
echo "=== DISK AND MEMORY ==="
df -h
echo ""
free -m

echo "=== GSA SERVICES & TIMERS ==="
systemctl list-units 'gsa*' --all --no-pager
echo ""
systemctl list-timers 'gsa*' --all --no-pager

echo "=== FFMPEG / STREAM STATUS ==="
pgrep -fl ffmpeg || echo "No ffmpeg running"
systemctl status gsa-tv-stream.service --no-pager || true

echo "=== BACKUP SCRIPT CONTENT ==="
if [ -f /opt/gsa-tv/backup/gsa-tv-backup-full.sh ]; then
  ls -la /opt/gsa-tv/backup/gsa-tv-backup-full.sh
  cat /opt/gsa-tv/backup/gsa-tv-backup-full.sh
else
  echo "Backup script not found at /opt/gsa-tv/backup/gsa-tv-backup-full.sh"
fi

echo "=== EXISTING BACKUPS ==="
ls -la /opt/gsa-tv/backups/full/ 2>/dev/null || true

echo "=== DISK USAGE BY FOLDER ==="
du -sh /opt/gsa-tv/* 2>/dev/null || true
du -sh /opt/gsa-tv/cache/media/1/* 2>/dev/null || true
du -sh /home/opc/* 2>/dev/null || true
du -sh /home/opc/gsa-ai/* 2>/dev/null || true
du -sh /tmp 2>/dev/null || true
du -sh /var/tmp 2>/dev/null || true
`;

try {
  const res = await runSshScript(cmd, 60000);
  console.log(res.stdout);
  if (res.stderr) console.error("STDERR:", res.stderr);
} catch (e) {
  console.error("ERROR:", e);
}
