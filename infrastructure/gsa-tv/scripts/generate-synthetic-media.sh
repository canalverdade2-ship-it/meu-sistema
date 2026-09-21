#!/usr/bin/env bash
# GSA TV — geração de mídia sintética para testes técnicos
# Gera: barras SMPTE + relógio + tom 1 kHz + voz sintética (filtro)
# Saída: synthetic_test_60s.mp4 normalizado no padrão GSA TV
set -euo pipefail

OUT_DIR="${1:-/opt/gsa-tv/cache/media/synthetic}"
DURATION="${DURATION:-60}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

mkdir -p "$OUT_DIR"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

echo "[GSA-TV] Gerando mídia sintética — ${DURATION} s..."

# Arquivo 1: barras SMPTE + relógio + tom 1 kHz
ffmpeg \
  -hide_banner -loglevel warning \
  -f lavfi \
  -i "smptehdbars=size=1280x720:rate=30" \
  -f lavfi \
  -i "sine=frequency=1000:sample_rate=48000" \
  -vf "drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:\
text='GSA TV — TESTE TÉCNICO %{pts\\:localtime\\:$(date +%s)}':x=40:y=40:\
fontsize=28:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=6" \
  -c:v libx264 -profile:v high -b:v 4000k -maxrate:v 4200k -bufsize:v 8000k \
  -g 60 -keyint_min 60 -sc_threshold 0 \
  -c:a aac -b:a 128k -ar 48000 -ac 2 \
  -t "$DURATION" \
  -movflags +faststart \
  -y "${TMP}/synthetic_bars.mp4"

# Arquivo 2: slate preto com tom 1 kHz (separador técnico)
ffmpeg \
  -hide_banner -loglevel warning \
  -f lavfi -i "color=black:size=1280x720:rate=30" \
  -f lavfi -i "sine=frequency=1000:sample_rate=48000" \
  -vf "drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:\
text='SLATE — GSA TV':x=(w-text_w)/2:y=(h-text_h)/2:\
fontsize=48:fontcolor=white" \
  -c:v libx264 -profile:v high -b:v 4000k -maxrate:v 4200k -bufsize:v 8000k \
  -g 60 -keyint_min 60 -sc_threshold 0 \
  -c:a aac -b:a 128k -ar 48000 -ac 2 \
  -t 10 \
  -movflags +faststart \
  -y "${TMP}/synthetic_slate.mp4"

# Copiar para destino e verificar
cp "${TMP}/synthetic_bars.mp4"  "${OUT_DIR}/synthetic_test_${DURATION}s.mp4"
cp "${TMP}/synthetic_slate.mp4" "${OUT_DIR}/synthetic_slate_10s.mp4"

for F in "${OUT_DIR}/synthetic_test_${DURATION}s.mp4" "${OUT_DIR}/synthetic_slate_10s.mp4"; do
  CHECKSUM=$(sha256sum "$F" | awk '{print $1}')
  echo "[GSA-TV] Gerado: $F (SHA-256: $CHECKSUM)"
done

echo "[GSA-TV] Mídia sintética pronta em: $OUT_DIR"