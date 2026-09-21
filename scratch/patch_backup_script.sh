sudo bash -s << 'EOF'
set -e
cp /opt/gsa-tv/backup/gsa-tv-backup-full.sh /opt/gsa-tv/backup/gsa-tv-backup-full.sh.bak-permissions

python3 - << 'PY_EOF'
with open('/opt/gsa-tv/backup/gsa-tv-backup-full.sh', 'r') as f:
    content = f.read()

# Fix 1: ensure mkdir creates with group gsa-tv
old_mkdir = 'mkdir -p "$BACKUP_ROOT" "$TMP"\nchmod 0750 "$BACKUP_ROOT" "$TMP"'
new_mkdir = '''mkdir -p "$BACKUP_ROOT" "$TMP"
chgrp gsa-tv "$BACKUP_ROOT" "$TMP" 2>/dev/null || true
chmod 0750 "$BACKUP_ROOT" "$TMP"'''

if old_mkdir in content:
    content = content.replace(old_mkdir, new_mkdir, 1)
else:
    print("WARNING: old_mkdir not found")

# Fix 2: after promotion and purge, ensure OUT permissions and update symlink
old_end = '''# Mantém exclusivamente o backup mais recente recém-verificado, expurgando backups anteriores
ls -dt "$BACKUP_ROOT"/20* 2>/dev/null | tail -n +2 | xargs -r rm -rf --
echo "$OUT"'''

new_end = '''# Mantém exclusivamente o backup mais recente recém-verificado, expurgando backups anteriores
ls -dt "$BACKUP_ROOT"/20* 2>/dev/null | tail -n +2 | xargs -r rm -rf --
chgrp -R gsa-tv "$OUT" 2>/dev/null || true
chmod 0750 "$OUT" 2>/dev/null || true
chmod 0640 "$OUT"/* 2>/dev/null || true
ln -sf "$OUT/media-and-playout.tgz" "$BASE/backups/gsa-tv-backup-media-full-latest.tgz"
chown -h gsa-tv:gsa-tv "$BASE/backups/gsa-tv-backup-media-full-latest.tgz" 2>/dev/null || true
echo "$OUT"'''

if old_end in content:
    content = content.replace(old_end, new_end, 1)
else:
    print("WARNING: old_end not found")

with open('/opt/gsa-tv/backup/gsa-tv-backup-full.sh', 'w') as f:
    f.write(content)

print("Successfully updated /opt/gsa-tv/backup/gsa-tv-backup-full.sh")
PY_EOF

bash -n /opt/gsa-tv/backup/gsa-tv-backup-full.sh
echo "Syntax check OK!"
EOF
