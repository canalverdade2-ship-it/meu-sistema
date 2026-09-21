#!/usr/bin/env bash
set -euo pipefail
DB="postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub"

echo "=== [R5] Atualizando gsa-tv-backup.service na VPS ==="

sudo tee /etc/systemd/system/gsa-tv-backup.service > /dev/null << 'UNIT'
[Unit]
Description=Full verified backup for GSA TV (PostgreSQL + SQLite + media)
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
ExecStart=/opt/gsa-tv/backup/gsa-tv-backup-full.sh
User=root
Group=root
StandardOutput=journal
StandardError=journal
UNIT

echo "Arquivo gravado. Recarregando daemon..."
sudo systemctl daemon-reload

echo "Verificando ExecStart:"
systemctl show gsa-tv-backup.service -p ExecStart

echo ""
echo "Script alvo existe?"
ls -la /opt/gsa-tv/backup/gsa-tv-backup-full.sh
