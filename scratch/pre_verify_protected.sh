#!/usr/bin/env bash
set -e

echo "=== CHECKING ESSENTIAL PROTECTED ASSETS ==="

FILES_TO_CHECK=(
  "/opt/gsa-tv/runtime/gsa-tv-live-badge.txt"
  "/opt/gsa-tv/fallback/gsa-tv-fallback-720p30.mp4"
  "/opt/gsa-tv/cache/media/1/filler/gsa-tv-filler-600.mp4"
  "/opt/gsa-tv/cache/media/1/filler/filler.mp4"
  "/opt/gsa-tv/cache/media/1/identity/gsa-tv-logo-transparent.png"
  "/opt/gsa-tv/cache/media/1/identity/gsa-tv-continuity-720p30.mp4"
  "/opt/gsa-tv/cache/media/1/identity/vinhetas/vinheta-gsa-news.mp4"
  "/opt/gsa-tv/cache/media/1/identity/vinhetas/vinheta-gsa-manha-news.mp4"
  "/opt/gsa-tv/cache/media/1/identity/vinhetas/vinheta-gsa-boletim-financeiro.mp4"
  "/opt/gsa-tv/cache/media/1/identity/vinhetas/vinheta-gsa-ta-na-rede-tv.mp4"
  "/opt/gsa-tv/cache/media/1/GSA-TV-CHAMADA-OFICIAL-GRADE-AUDIO-CLEAN.mp4"
  "/opt/gsa-tv/cache/media/1/media-7d79a725-8a7e-4605-9ec1-84e446c0c579.mp4"
  "/opt/gsa-tv/cache/media/1/media-gsa-chamada-grade-v2-85s-broadcast-safe-v3-aac-20260907.mp4"
  "/opt/gsa-tv/cache/media/1/media-gsa-chamada-grade-v2-85s-final-20260907.mp4"
  "/opt/gsa-tv/cache/media/1/media-gsa-chamada-grade-v2-85s-broadcast-safe-20260907.mov"
  "/opt/gsa-tv/cache/media/1/media-gsa-chamada-grade-v2-85s-broadcast-safe-v2-20260907.mov"
  "/opt/gsa-tv/cache/media/1/program-masters/gsa-manha-news-20260909-30m.mp4"
  "/opt/gsa-tv/cache/media/1/program-masters/gsa-historias-da-biblia-o-filho-prodigo-30m.mp4"
  "/opt/gsa-tv/playlists/1/2026-09-09.json"
  "/opt/gsa-tv/playlists/1/2026-09-10.json"
)

all_ok=1
for f in "${FILES_TO_CHECK[@]}"; do
  if [ -f "$f" ]; then
    size=$(ls -lh "$f" | awk '{print $5}')
    echo "[OK] $size $f"
  else
    echo "[MISSING] $f"
    all_ok=0
  fi
done

if [ "$all_ok" -eq 1 ]; then
  echo "ALL ESSENTIAL ASSETS VERIFIED PRESENT."
else
  echo "ERROR: SOME ESSENTIAL ASSETS MISSING!"
  exit 1
fi
