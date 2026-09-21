#!/usr/bin/env bash
# GSA TV — Benchmark comparativo de performance ARM64: 720p30 vs 1080p30 vs 1080p60
# Uso: bash benchmark-profiles.sh
set -euo pipefail

DURATION=20
TMP_DIR="/tmp/gsa-tv-bench-profiles"
mkdir -p "$TMP_DIR"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "========================================================"
echo " GSA TV — Benchmark de Perfis de Vídeo (Oracle ARM64)"
echo " Testando duração de ${DURATION}s para cada perfil..."
echo "========================================================"

run_bench() {
  local name="$1"
  local w="$2"
  local h="$3"
  local fps="$4"
  local bitrate="$5"
  local gop="$6"
  local level="$7"
  local out="${TMP_DIR}/test_${name}.mp4"

  echo ""
  echo "▶ Testando Perfil: $name (${w}x${h} @ ${fps}fps | ${bitrate})..."

  local t_start
  t_start=$(date +%s%N)

  ffmpeg -hide_banner -loglevel error \
    -f lavfi -i "testsrc=size=${w}x${h}:rate=${fps}" \
    -f lavfi -i "sine=frequency=1000:sample_rate=48000" \
    -c:v libx264 -profile:v high -level:v "$level" \
    -b:v "$bitrate" -maxrate "$bitrate" -bufsize "$((${bitrate%k} * 2))k" \
    -x264-params "nal-hrd=cbr:force-cfr=1" \
    -g "$gop" -keyint_min "$gop" -sc_threshold 0 \
    -c:a aac -b:a 128k -ar 48000 -ac 2 \
    -t "$DURATION" -y "$out"

  local t_end
  t_end=$(date +%s%N)
  local elapsed_ms=$(( (t_end - t_start) / 1000000 ))
  local speed
  speed=$(python3 -c "print(round(${DURATION} / (${elapsed_ms} / 1000.0), 2))")
  local size_mb
  size_mb=$(python3 -c "import os; print(round(os.path.getsize('$out') / (1024*1024), 2))")

  echo "  ✓ Tempo gasto       : $((elapsed_ms / 1000)).$((elapsed_ms % 1000))s"
  echo "  ✓ Velocidade encode : ${speed}x tempo real"
  echo "  ✓ Tamanho gerado    : ${size_mb} MB"

  if (( $(python3 -c "print(1 if ${speed} >= 1.0 else 0)") )); then
    echo "  ✓ Viabilidade 24/7  : APROVADO (Capacidade em tempo real garantida)"
  else
    echo "  ✗ Viabilidade 24/7  : REPROVADO (Gargalo de CPU)"
  fi
}

run_bench "720p30 (Padrão 24/7)" 1280 720 30 "4000k" 60 "4.0"
run_bench "1080p30 (Full HD)"    1920 1080 30 "6000k" 60 "4.1"
run_bench "1080p60 (Full HD Max)" 1920 1080 60 "8500k" 120 "4.2"

echo ""
echo "========================================================"
echo " Benchmark concluído com sucesso."
echo "========================================================"
