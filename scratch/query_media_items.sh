#!/usr/bin/env bash
set -e
ENV_FILE="/opt/gsa-tv/control-plane/.env"
DB_URL="$(sudo awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}' "$ENV_FILE")"
sudo -u opc psql "$DB_URL" -c "SELECT id, title, media_type, storage_path, status, duration_seconds FROM public.gsa_tv_media_items ORDER BY media_type, title;"
