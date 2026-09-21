import { runSshScript } from './ssh2-run.mjs';

const cmd = `
echo "=== DISK AND MEMORY ==="
df -h
echo ""
free -m

echo "=== GSA STREAM & SYSTEMD SERVICES ==="
systemctl list-units --type=service 'gsa*' --all --no-pager
echo ""
systemctl list-units --type=service '*stream*' --all --no-pager
echo ""
pgrep -fl ffmpeg || echo "No ffmpeg running"
echo ""
ps aux | grep -E 'ffmpeg|stream|gsa' | grep -v 'grep'

echo "=== BACKUP SCRIPT CONTENT (SUDO) ==="
sudo ls -la /opt/gsa-tv/backup/gsa-tv-backup-full.sh
sudo head -n 40 /opt/gsa-tv/backup/gsa-tv-backup-full.sh

echo "=== EXISTING BACKUPS LIST ==="
sudo ls -la /opt/gsa-tv/backups/full/

echo "=== MEDIA CACHE STRUCTURE ==="
sudo du -sh /opt/gsa-tv/cache/media/1/*
sudo ls -la /opt/gsa-tv/cache/media/1/
`;

const res = await runSshScript(cmd, 60000);
console.log(res.stdout);
if (res.stderr) console.error("STDERR:", res.stderr);
