#!/usr/bin/env bash
# GSA TV — transmissão RTMPS para o YouTube
# A chave RTMPS deve estar no arquivo apontado por RTMPS_KEY_FILE.
# Sem a chave, o script recusa-se a executar (proteção contra transmissão acidental).
# Uso: preset-rtmps.sh <entrada.mp4|playlist.m3u8>
set -euo pipefail

INPUT="${1:-}"
RTMPS_KEY_FILE="${RTMPS_KEY_FILE:-/opt/gsa-tv/secrets/rtmps-key}"
RTMPS_URL="${RTMPS_URL:-rtmps://a.rtmps.youtube.com:443/live2}"
LOG_LEVEL="${LOG_LEVEL:-warning}"

if [[ -z "$INPUT" ]]; then
  echo >&2 "Uso: RTMPS_KEY_FILE=/path/to/key $0 <entrada>"
  exit 2
fi

# PROTEÇÃO: recusa executar sem chave real
if [[ ! -f "$RTMPS_KEY_FILE" ]]; then
  echo >&2 "ERRO: arquivo de chave RTMPS não encontrado: $RTMPS_KEY_FILE"
  echo >&2 "Configure a chave antes de iniciar a transmissão."
  exit 3
fi

RTMPS_KEY=$(cat "$RTMPS_KEY_FILE")
if [[ -z "$RTMPS_KEY" ]]; then
  echo >&2 "ERRO: chave RTMPS está vazia."
  exit 3
fi

# Nunca imprime a chave em logs ou stdout
TARGET="${RTMPS_URL}/${RTMPS_KEY}"

echo "[GSA-TV] Iniciando RTMPS para YouTube..."
echo "[GSA-TV] Entrada : $INPUT"
echo "[GSA-TV] URL base: $RTMPS_URL/***"

ffmpeg \
  -hide_banner \
  -loglevel "$LOG_LEVEL" \
  -re \
  -i "$INPUT" \
  -c:v libx264 \
  -profile:v high \
  -level:v 4.0 \
  -b:v 4000k \
  -maxrate:v 4200k \
  -bufsize:v 8000k \
  -x264-params "nal-hrd=cbr:force-cfr=1" \
  -g 60 \
  -keyint_min 60 \
  -sc_threshold 0 \
  -c:a aac \
  -b:a 128k \
  -ar 48000 \
  -ac 2 \
  -f flv \
  "$TARGET"

unset RTMPS_KEY TARGET