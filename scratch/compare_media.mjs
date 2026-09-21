import { runSshScript } from './ssh2-run.mjs';

const cmd = `
sudo bash -c '
# List all files currently in /opt/gsa-tv/cache/media
find /opt/gsa-tv/cache/media -type f | sort > /tmp/current_media.txt

# Extract file paths from existing backup media.sha256
awk "{print \\$2}" /opt/gsa-tv/backups/full/20260907T062245Z/media.sha256 | sort > /tmp/backup_media.txt

echo "=== CURRENT MEDIA FILES COUNT ==="
wc -l /tmp/current_media.txt

echo "=== BACKUP MEDIA FILES COUNT ==="
wc -l /tmp/backup_media.txt

echo "=== FILES IN CURRENT MEDIA BUT NOT IN BACKUP ==="
comm -23 /tmp/current_media.txt /tmp/backup_media.txt > /tmp/new_media_files.txt
wc -l /tmp/new_media_files.txt
head -n 50 /tmp/new_media_files.txt
'
`;

const res = await runSshScript(cmd, 30000);
console.log(res.stdout);
