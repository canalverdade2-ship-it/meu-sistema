sudo bash -s << 'EOF'
set -e
echo "=== FIXING BACKUP PERMISSIONS ==="
chgrp -R gsa-tv /opt/gsa-tv/backups/full
chmod 0750 /opt/gsa-tv/backups/full
chmod 0750 /opt/gsa-tv/backups/full/*
chmod 0640 /opt/gsa-tv/backups/full/*/*
chown -h gsa-tv:gsa-tv /opt/gsa-tv/backups/gsa-tv-backup-media-full-latest.tgz
chown gsa-tv:gsa-tv /opt/gsa-tv/backups/gsa-ai-scripts-20260910.tgz

echo "=== VERIFYING NON-ROOT ACCESS TO LATEST BACKUP ==="
sudo -u gsa-tv head -c 10 /opt/gsa-tv/backups/gsa-tv-backup-media-full-latest.tgz | xxd
sudo -u opc head -c 10 /opt/gsa-tv/backups/gsa-tv-backup-media-full-latest.tgz | xxd
echo "Access successfully verified for both gsa-tv and opc!"
EOF
