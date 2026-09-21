#!/usr/bin/env bash
# GSA TV — geração de preview HLS interno
# Segmentos de 6 s, lista de 5 segmentos, sem criptografia (placeholder para AES-128).
# Uso: preset-hls.sh <entrada.mp4> <diretório-hls/>
set -euo pipefail

INPUT="${1:-}"
HLS_DIR="${2:-}"
LOG_LEVEL="${LOG_LEVEL:-warning}"

if [[ -z "$INPUT" || -z "$HLS_DIR" ]]; then
  echo >&2 "Uso: $0 <entrada.mp4> <diretório-hls/>"
  exit 2
fi
if [[ ! -f "$INPUT" ]]; then
  echo >&2 "Arquivo não encontrado: $INPUT"
  exit 1
fi

mkdir -p "$HLS_DIR"

ffmpeg \
  -hide_banner \
  -loglevel "$LOG_LEVEL" \
  -i "$INPUT" \
  -c:v libx264 \
  -profile:v high \
  -level:v 4.0 \
  -b:v 3500k \
  -maxrate:v 3700k \
  -bufsize:v 7000k \
  -g 60 \
  -keyint_min 60 \
  -sc_threshold 0 \
  -c:a aac \
  -b:a 128k \
  -ar 48000 \
  -ac 2 \
  -f hls \
  -hls_time 6 \
  -hls_list_size 5 \
  -hls_flags delete_segments+append_list+omit_endlist \
  -hls_segment_filename "${HLS_DIR}/seg%05d.ts" \
  -hls_segment_type mpegts \
  -y \
  "${HLS_DIR}/playlist.m3u8"

echo "[GSA-TV] HLS gerado em: $HLS_DIR"
ls -lh "$HLS_DIR"