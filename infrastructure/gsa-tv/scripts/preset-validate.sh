#!/usr/bin/env bash
# GSA TV — validação técnica de arquivo de mídia
# Uso: preset-validate.sh <arquivo> [--json]
# Saída: JSON com codec, resolução, fps, duração, bitrate, checksum (se --json)
# Retorna 0 se aprovado, 1 se reprovado.
set -euo pipefail

FILE="${1:-}"
JSON_OUT=false
[[ "${2:-}" == "--json" ]] && JSON_OUT=true

if [[ -z "$FILE" || ! -f "$FILE" ]]; then
  echo >&2 "Uso: $0 <arquivo> [--json]"
  exit 2
fi

PROBE=$(ffprobe \
  -v error \
  -print_format json \
  -show_format \
  -show_streams \
  "$FILE" 2>&1)

if ! echo "$PROBE" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null; then
  echo >&2 "ffprobe falhou: $PROBE"
  exit 1
fi

# Extrair campos relevantes
VCODEC=$(echo "$PROBE" | python3 -c "
import sys,json; d=json.load(sys.stdin)
vs=[s for s in d.get('streams',[]) if s.get('codec_type')=='video']
print(vs[0].get('codec_name','unknown') if vs else 'none')
")
WIDTH=$(echo "$PROBE" | python3 -c "
import sys,json; d=json.load(sys.stdin)
vs=[s for s in d.get('streams',[]) if s.get('codec_type')=='video']
print(vs[0].get('width',0) if vs else 0)
")
HEIGHT=$(echo "$PROBE" | python3 -c "
import sys,json; d=json.load(sys.stdin)
vs=[s for s in d.get('streams',[]) if s.get('codec_type')=='video']
print(vs[0].get('height',0) if vs else 0)
")
FPS_RAW=$(echo "$PROBE" | python3 -c "
import sys,json; d=json.load(sys.stdin)
vs=[s for s in d.get('streams',[]) if s.get('codec_type')=='video']
print(vs[0].get('r_frame_rate','0/1') if vs else '0/1')
")
FPS=$(python3 -c "a,b=map(int,'${FPS_RAW}'.split('/')); print(round(a/b,3) if b else 0)")
DURATION=$(echo "$PROBE" | python3 -c "
import sys,json; d=json.load(sys.stdin)
print(float(d.get('format',{}).get('duration',0)))
")
ACODEC=$(echo "$PROBE" | python3 -c "
import sys,json; d=json.load(sys.stdin)
as_=[s for s in d.get('streams',[]) if s.get('codec_type')=='audio']
print(as_[0].get('codec_name','none') if as_ else 'none')
")
SAMPLE_RATE=$(echo "$PROBE" | python3 -c "
import sys,json; d=json.load(sys.stdin)
as_=[s for s in d.get('streams',[]) if s.get('codec_type')=='audio']
print(as_[0].get('sample_rate','0') if as_ else '0')
")
CHANNELS=$(echo "$PROBE" | python3 -c "
import sys,json; d=json.load(sys.stdin)
as_=[s for s in d.get('streams',[]) if s.get('codec_type')=='audio']
print(as_[0].get('channels',0) if as_ else 0)
")
SIZE=$(stat -c%s "$FILE")
CHECKSUM=$(sha256sum "$FILE" | awk '{print $1}')

# Regras de validação (permissivas — aceita qualquer codec; normalização é feita depois)
PASS=true
REASONS=[]

if (( $(echo "$DURATION < 5" | bc -l) )); then
  PASS=false
  REASONS="duração < 5 s"
fi
if [[ "$VCODEC" == "none" ]]; then
  PASS=false
  REASONS="${REASONS:+${REASONS}, }sem stream de vídeo"
fi
if [[ "$ACODEC" == "none" ]]; then
  PASS=false
  REASONS="${REASONS:+${REASONS}, }sem stream de áudio"
fi

if $JSON_OUT; then
  python3 - <<PYEOF
import json
result = {
  "file": "${FILE}",
  "pass": $([ "$PASS" = true ] && echo true || echo false),
  "reasons": "${REASONS}",
  "video": {"codec": "${VCODEC}", "width": ${WIDTH}, "height": ${HEIGHT}, "fps": ${FPS}},
  "audio": {"codec": "${ACODEC}", "sample_rate": int("${SAMPLE_RATE}"), "channels": ${CHANNELS}},
  "duration_s": ${DURATION},
  "size_bytes": ${SIZE},
  "sha256": "${CHECKSUM}"
}
print(json.dumps(result, indent=2))
PYEOF
else
  echo "Arquivo : $FILE"
  echo "Vídeo   : ${VCODEC} ${WIDTH}x${HEIGHT} @ ${FPS} fps"
  echo "Áudio   : ${ACODEC} ${SAMPLE_RATE} Hz ${CHANNELS}ch"
  echo "Duração : ${DURATION} s"
  echo "Tamanho : ${SIZE} bytes"
  echo "SHA-256 : ${CHECKSUM}"
  echo "Status  : $([ "$PASS" = true ] && echo 'APROVADO' || echo "REPROVADO — ${REASONS}")"
fi

[[ "$PASS" == "true" ]] && exit 0 || exit 1