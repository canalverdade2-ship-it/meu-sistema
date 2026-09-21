#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/opt/gsa-tv/backups/ffplayout"
backup_stamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_name="ffplayout-${backup_stamp}.db"

install -d -o gsa-tv -g gsa-tv -m 0750 "${BACKUP_DIR}"

docker exec gsa-tv-ffplayout \
  sqlite3 /state/ffplayout.db ".backup '/backups/${backup_name}'"

chmod 0640 "${BACKUP_DIR}/${backup_name}"
sha256sum "${BACKUP_DIR}/${backup_name}" > "${BACKUP_DIR}/${backup_name}.sha256"
chmod 0640 "${BACKUP_DIR}/${backup_name}.sha256"

echo "${BACKUP_DIR}/${backup_name}"

