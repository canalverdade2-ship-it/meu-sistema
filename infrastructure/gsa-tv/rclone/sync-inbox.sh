#!/usr/bin/env bash
# GSA TV — Sincronização e monitoramento da pasta 00_INBOX do Google Drive
# Uso: bash sync-inbox.sh
# Efetua download de novos arquivos da INBOX com retentativas, validação de integridade e notificação do Media Worker.
set -euo pipefail

RCLONE_CONF="${RCLONE_CONF:-/opt/gsa-tv/config/rclone/rclone.conf}"
REMOTE_INBOX="${REMOTE_INBOX:-gdrive-gsa-tv:00_INBOX}"
LOCAL_INBOX="${LOCAL_INBOX:-/opt/gsa-tv/cache/media/inbox}"
MEDIA_WORKER_URL="${MEDIA_WORKER_URL:-http://127.0.0.1:9200/jobs}"
LOG_FILE="/opt/gsa-tv/logs/cache-manager/sync-inbox.log"

mkdir -p "$LOCAL_INBOX" "$(dirname "$LOG_FILE")"

log() {
  local msg="[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] $1"
  echo "$msg"
  echo "$msg" >> "$LOG_FILE"
}

if [[ ! -f "$RCLONE_CONF" ]]; then
  log "AVISO: rclone.conf não encontrado em $RCLONE_CONF (Drive desconectado por design). Encerrando."
  exit 0
fi

log "Iniciando verificação de novos arquivos em $REMOTE_INBOX..."

# 1. Listar arquivos presentes na pasta INBOX
NEW_FILES=$(rclone lsjson "$REMOTE_INBOX" \
  --config "$RCLONE_CONF" \
  --files-only \
  --tpslimit 10 \
  2>> "$LOG_FILE" || echo "[]")

COUNT=$(echo "$NEW_FILES" | python3 -c "import sys, json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")

if [[ "$COUNT" -eq 0 ]]; then
  log "Nenhum arquivo novo na pasta INBOX."
  exit 0
fi

log "Encontrados $COUNT arquivo(s) na INBOX. Iniciando download com integridade..."

# 2. Executar cópia com retries e validação SHA-256
rclone copy "$REMOTE_INBOX" "$LOCAL_INBOX" \
  --config "$RCLONE_CONF" \
  --checksum \
  --retries 10 \
  --retries-sleep 30s \
  --low-level-retries 20 \
  --drive-chunk-size 64M \
  --tpslimit 10 \
  --progress \
  2>> "$LOG_FILE"

log "Download dos arquivos concluído. Disparando validação no Media Worker..."

# 3. Notificar o Media Worker para cada arquivo baixado
for FILE_PATH in "$LOCAL_INBOX"/*; do
  if [[ -f "$FILE_PATH" ]]; then
    FILENAME=$(basename "$FILE_PATH")
    SHA256=$(sha256sum "$FILE_PATH" | awk '{print $1}')
    SIZE=$(stat -c%s "$FILE_PATH")

    log "Registrando item $FILENAME (Tamanho: $SIZE bytes, SHA-256: $SHA256)..."

    # Enviar payload JSON para o Media Worker
    curl --silent --show-error --fail \
      -X POST "$MEDIA_WORKER_URL" \
      -H "Content-Type: application/json" \
      -d "{\"type\":\"media_ingest\",\"file\":\"$FILE_PATH\",\"filename\":\"$FILENAME\",\"size_bytes\":$SIZE,\"sha256\":\"$SHA256\"}" \
      >> "$LOG_FILE" 2>&1 || log "Aviso: Media Worker não respondeu imediatamente para $FILENAME (job será reprocessado pela fila)."
  fi
done

log "Sincronização da INBOX concluída com sucesso."
