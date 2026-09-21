#!/usr/bin/env bash
set -euo pipefail

IMAGE="${IMAGE:-gsa-tv/ffplayout:2.1.0-arm64}"
STATE_DIR="${STATE_DIR:-/opt/gsa-tv/config/ffplayout}"
ADMIN_PASSWORD_FILE="${ADMIN_PASSWORD_FILE:-/opt/gsa-tv/secrets/ffplayout-admin-password}"
SMTP_PASSWORD_FILE="${SMTP_PASSWORD_FILE:-/opt/gsa-tv/secrets/ffplayout-smtp-password}"

if [[ -e "${STATE_DIR}/ffplayout.db" ]]; then
  echo "ffplayout database already exists; initialization skipped"
  exit 0
fi

IFS= read -r ADMIN_PASSWORD < "${ADMIN_PASSWORD_FILE}"
IFS= read -r SMTP_PASSWORD < "${SMTP_PASSWORD_FILE}"

docker run --rm -t \
  --network none \
  --security-opt no-new-privileges \
  --cap-drop ALL \
  --volume "${STATE_DIR}:/state" \
  --volume /opt/gsa-tv/playlists:/playlists \
  --volume /opt/gsa-tv/cache/media:/media \
  --volume /opt/gsa-tv/preview:/public \
  --volume /opt/gsa-tv/logs:/logs \
  "${IMAGE}" \
  --init \
  --username admin \
  --mail admin@gsa-tv.local \
  --password "${ADMIN_PASSWORD}" \
  --two-factor false \
  --smtp-server localhost \
  --smtp-user gsa-tv \
  --smtp-password "${SMTP_PASSWORD}" \
  --smtp-starttls false \
  --smtp-port 25 \
  --storage /media \
  --logs /logs \
  --public /public \
  --playlists /playlists \
  --db /state/ffplayout.db

unset ADMIN_PASSWORD SMTP_PASSWORD

