#!/usr/bin/env bash
set -e
ENV_FILE="/opt/gsa-tv/control-plane/.env"
DB_URL="$(sudo awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}' "$ENV_FILE")"
sudo -u opc psql "$DB_URL" -c "\d public.gsa_tv_media_items"
sudo -u opc psql "$DB_URL" -c "SELECT * FROM public.gsa_tv_media_items LIMIT 5;"
