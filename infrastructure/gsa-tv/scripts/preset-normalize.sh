#!/usr/bin/env bash
# GSA TV — normalização para padrão técnico de transmissão
# Suporta perfis dinâmicos: 720p30, 1080p30 (Full HD) e 1080p60 (Full HD 60fps)
# Uso: preset-normalize.sh <entrada> <saída.mp4> [perfil: 720p30|1080p30|1080p60]
set -euo pipefail

INPUT="${1:-}"
OUTPUT="${2:-}"
PROFILE="${3:-${PRESET_PROFILE:-720p30}}"
LOG_LEVEL="${LOG_LEVEL:-warning}"

if [[ -z "$INPUT" || -z "$OUTPUT" ]]; then
  echo >&2 "Uso: $0 <entrada> <saída.mp4> [720p30|1080p30|1080p60]"
  exit 2
fi
if [[ ! -f "$INPUT" ]]; then
  echo >&2 "Arquivo não encontrado: $INPUT"
  exit 1
fi
if [[ -f "$OUTPUT" ]]; then
  echo >&2 "Saída já existe: $OUTPUT (remova antes de normalizar)"
  exit 1
fi

case "$PROFILE" in
  1080p60)
    WIDTH=1920
    HEIGHT=1080
    FPS=60
    VBITRATE="8500k"
    MAXRATE="9000k"
    BUFSIZE="17000k"
    GOP=120
    X264_LEVEL="4.2"
    ;;
  1080p30|1080p|fhd)
    WIDTH=1920
    HEIGHT=1080
    FPS=30
    VBITRATE="6000k"
    MAXRATE="6300k"
    BUFSIZE="12000k"
    GOP=60
    X264_LEVEL="4.1"
    ;;
  720p30|720p|hd|*)
    WIDTH=1280
    HEIGHT=720
    FPS=30
    VBITRATE="4000k"
    MAXRATE="4200k"
    BUFSIZE="8000k"
    GOP=60
    X264_LEVEL="4.0"
    ;;
esac

OUTPUT_DIR=$(dirname "$OUTPUT")
mkdir -p "$OUTPUT_DIR"

echo "[GSA-TV] Perfil selecionado: ${WIDTH}x${HEIGHT} @ ${FPS}fps | Bitrate: ${VBITRATE}"
echo "[GSA-TV] Passo 1/2 — análise loudnorm (EBU R128)..."
LOUDNORM_ANALYSIS=$(ffmpeg \
  -hide_banner \
  -i "$INPUT" \
  -af loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json \
  -f null /dev/null 2>&1 | tail -12)

I_MEAS=$(echo    "$LOUDNORM_ANALYSIS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['input_i'])")
TP_MEAS=$(echo   "$LOUDNORM_ANALYSIS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['input_tp'])")
LRA_MEAS=$(echo  "$LOUDNORM_ANALYSIS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['input_lra'])")
THR_MEAS=$(echo  "$LOUDNORM_ANALYSIS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['input_thresh'])")
OFFSET=$(echo    "$LOUDNORM_ANALYSIS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['target_offset'])")

echo "[GSA-TV] Passo 2/2 — encode final H.264 High CBR (${WIDTH}x${HEIGHT} @ ${FPS}fps)..."
ffmpeg \
  -hide_banner \
  -loglevel "$LOG_LEVEL" \
  -i "$INPUT" \
  -vf "scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease,pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${FPS}" \
  -c:v libx264 \
  -profile:v high \
  -level:v "$X264_LEVEL" \
  -b:v "$VBITRATE" \
  -maxrate:v "$MAXRATE" \
  -bufsize:v "$BUFSIZE" \
  -x264-params "nal-hrd=cbr:force-cfr=1" \
  -g "$GOP" \
  -keyint_min "$GOP" \
  -sc_threshold 0 \
  -c:a aac \
  -b:a 128k \
  -ar 48000 \
  -ac 2 \
  -af "loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${I_MEAS}:measured_TP=${TP_MEAS}:measured_LRA=${LRA_MEAS}:measured_thresh=${THR_MEAS}:offset=${OFFSET}:linear=true:print_format=none" \
  -movflags +faststart \
  -y \
  "$OUTPUT"

SIZE=$(stat -c%s "$OUTPUT")
CHECKSUM=$(sha256sum "$OUTPUT" | awk '{print $1}')
echo "[GSA-TV] Normalização concluída com sucesso."
echo "  Perfil   : ${WIDTH}x${HEIGHT} @ ${FPS}fps (${VBITRATE})"
echo "  Saída    : $OUTPUT"
echo "  Tamanho  : $SIZE bytes"
echo "  SHA-256  : $CHECKSUM"