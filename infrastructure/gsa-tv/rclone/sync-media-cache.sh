#!/usr/bin/env bash
# GSA TV — Download seguro e abastecimento do Cache 48h a partir do Google Drive
# Uso: bash sync-media-cache.sh <caminho_remoto> <caminho_local_destino> [sha256_esperado]
set -euo pipefail

REMOTE_PATH="${1:-}"
LOCAL_DEST="${2:-}"
EXPECTED_SHA256="${3:-}"
RCLONE_CONF="${RCLONE_CONF:-/opt/gsa-tv/config/rclone/rclone.conf}"

if [[ -z "$REMOTE_PATH" || -z "$LOCAL_DEST" ]]; then
  echo >&2 "Uso: $0 <caminho_remoto> <caminho_local_destino> [sha256_esperado]"
  exit 2
fi

if [[ ! -f "$RCLONE_CONF" ]]; then
  echo >&2 "ERRO: rclone.conf não encontrado em $RCLONE_CONF"
  exit 3
fi

mkdir -p "$(dirname "$LOCAL_DEST")"

echo "[GSA-TV] Baixando $REMOTE_PATH para $LOCAL_DEST..."

# Download com integridade e retries
rclone copyto "gdrive-gsa-tv:${REMOTE_PATH}" "$LOCAL_DEST" \
  --config "$RCLONE_CONF" \
  --checksum \
  --retries 10 \
  --retries-sleep 30s \
  --low-level-retries 20 \
  --drive-chunk-size 64M \
  --tpslimit 10 \
  --progress

if [[ ! -f "$LOCAL_DEST" ]]; then
  echo >&2 "ERRO: Arquivo destino não foi criado após download."
  exit 1
fi

ACTUAL_SHA256=$(sha256sum "$LOCAL_DEST" | awk '{print $1}')

if [[ -n "$EXPECTED_SHA256" && "$ACTUAL_SHA256" != "$EXPECTED_SHA256" ]]; then
  echo >&2 "ERRO DE INTEGRIDADE: SHA-256 divergente!"
  echo >&2 "  Esperado : $EXPECTED_SHA256"
  echo >&2 "  Obtido   : $ACTUAL_SHA256"
  rm -f "$LOCAL_DEST"
  exit 4
fi

SIZE=$(stat -c%s "$LOCAL_DEST")
echo "[GSA-TV] Download concluído e validado com sucesso."
echo "  Tamanho : $SIZE bytes"
echo "  SHA-256 : $ACTUAL_SHA256"
