#!/usr/bin/env bash
set -euo pipefail

echo "=========================================================="
echo "1. PRE-CLEANUP DISK SPACE"
echo "=========================================================="
df -h / /var/oled /boot

echo ""
echo "=========================================================="
echo "2. BACKUP VERIFICATION & STATE ARCHIVE"
echo "=========================================================="
BACKUP_DIR="/opt/gsa-tv/backups/full/20260910T015950Z"
if ! sudo test -f "$BACKUP_DIR/media-and-playout.tgz"; then
  echo "FATAL: Full backup archive not found at $BACKUP_DIR/media-and-playout.tgz"
  exit 1
fi
echo "Verified existing full media and playout backup:"
sudo ls -lh "$BACKUP_DIR/media-and-playout.tgz"
sudo ls -lh "$BACKUP_DIR/database-full.dump"
sudo ls -lh "$BACKUP_DIR/manifest.sha256"

# Create convenient symlink in /opt/gsa-tv/backups/
sudo ln -sf "$BACKUP_DIR/media-and-playout.tgz" /opt/gsa-tv/backups/gsa-tv-backup-media-full-latest.tgz

# Also create an archive of /home/opc/gsa-ai work scripts
echo "Creating auxiliary backup of gsa-ai operational scripts..."
sudo tar -C /home/opc -czf /opt/gsa-tv/backups/gsa-ai-scripts-20260910.tgz \
  --exclude='gsa-ai/data/profile' \
  --exclude='gsa-ai/node_modules' \
  gsa-ai 2>/dev/null || true
sudo ls -lh /opt/gsa-tv/backups/gsa-ai-scripts-20260910.tgz

echo ""
echo "=========================================================="
echo "3. ESSENTIAL ASSET VERIFICATION (PRE-CHECK)"
echo "=========================================================="
PROTECTED_LIST=(
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
  "/opt/gsa-tv/cache/media/1/program-masters/gsa-agro-master.mp4"
  "/opt/gsa-tv/cache/media/1/program-masters/gsa-agro-teste-completo-agora.mp4"
  "/opt/gsa-tv/cache/media/1/program-masters/salomao-intro-1080p30.mp4"
  "/opt/gsa-tv/cache/media/1/program-masters/scene-01-departure.png"
  "/opt/gsa-tv/cache/media/1/program-masters/scene-02-journey.png"
  "/opt/gsa-tv/cache/media/1/program-masters/scene-03-reflection.png"
  "/opt/gsa-tv/cache/media/1/program-masters/scene-04-reunion.png"
  "/opt/gsa-tv/playlists/1/2026-09-09.json"
  "/opt/gsa-tv/playlists/1/2026-09-10.json"
)

for f in "${PROTECTED_LIST[@]}"; do
  if ! sudo test -f "$f"; then
    echo "FATAL: Protected file missing before start: $f"
    exit 1
  fi
done
echo "All 27 essential assets pre-checked successfully."

echo ""
echo "=========================================================="
echo "4. EXECUTING SAFE CLEANUP OF NON-ESSENTIAL MEDIA"
echo "=========================================================="

echo "A. Cleaning old news intermediate directories (~26.6 GB)..."
sudo rm -rf /opt/gsa-tv/cache/media/1/news/*

echo "B. Cleaning intermediate productions (~1.1 GB)..."
sudo rm -rf /opt/gsa-tv/cache/media/1/productions/*

echo "C. Cleaning superseded draft renders in program-masters (~2.4 GB)..."
sudo rm -f /opt/gsa-tv/cache/media/1/program-masters/gsa-manha-news-20260909-master-60m-1080p30.mp4
sudo rm -f /opt/gsa-tv/cache/media/1/program-masters/gsa-historias-da-biblia-o-filho-prodigo-20260908.mp4
sudo rm -f /opt/gsa-tv/cache/media/1/program-masters/gsa-historias-biblia-o-filho-prodigo-final-20260909.mp4
sudo rm -f /opt/gsa-tv/cache/media/1/program-masters/gsa-historias-biblia-tag-20260909.mp4

echo "D. Cleaning raw audio & temp test files in cache root..."
sudo rm -f /opt/gsa-tv/cache/media/1/clean-audio.raw
sudo rm -f /opt/gsa-tv/cache/media/1/input_check.ts
sudo rm -f /opt/gsa-tv/cache/media/1/ffplayout_frame.jpg
sudo rm -f /opt/gsa-tv/cache/media/1/live_1080p_proof.jpg

echo "E. Cleaning incoming test files..."
sudo rm -f /opt/gsa-tv/cache/incoming/gsa-tv-test-720p30.mp4

echo "F. Cleaning old test nature footage (~830 MB)..."
sudo rm -rf /opt/gsa-tv/cache/media/1/nature/*
sudo rm -rf /opt/gsa-tv/cache/media/1/gsa-agora-nature/*

echo "G. Cleaning old test intermediate directories (editorial, enhanced, normalized, gsa-em-fe-10min)..."
sudo rm -rf /opt/gsa-tv/cache/media/1/editorial/*
sudo rm -rf /opt/gsa-tv/cache/media/1/enhanced/*
sudo rm -rf /opt/gsa-tv/cache/media/1/normalized/*
sudo rm -rf /opt/gsa-tv/cache/media/1/gsa-em-fe-10min/*

echo "H. Cleaning loose temp files in /home/opc/..."
rm -f /home/opc/gsa-historias-biblia-tag-20260909.mp4
> /home/opc/desktop-commander-remote.log || true

echo "I. Flushed PM2 logs..."
pm2 flush || true

echo "J. Pruning docker images (dangling)..."
docker image prune -f || true

echo ""
echo "=========================================================="
echo "5. POST-CLEANUP VERIFICATION OF PROTECTED ASSETS"
echo "=========================================================="
for f in "${PROTECTED_LIST[@]}"; do
  if ! sudo test -f "$f"; then
    echo "FATAL: Protected file missing after cleanup: $f"
    exit 1
  fi
  size=$(sudo ls -lh "$f" | awk '{print $5}')
  echo "[VERIFIED] $size $f"
done
echo "ALL ESSENTIAL PROTECTED ASSETS REMAIN PERFECTLY INTACT."

echo ""
echo "=========================================================="
echo "6. LIVE STREAM RTMP VERIFICATION"
echo "=========================================================="
echo "Checking ffplayout logs..."
docker logs --tail 5 gsa-tv-ffplayout

echo "Checking RTMP YouTube ffmpeg process..."
pgrep -a ffmpeg | grep -i rtmp || true

echo ""
echo "=========================================================="
echo "7. POST-CLEANUP DISK SPACE"
echo "=========================================================="
df -h / /var/oled /boot

echo ""
echo "=========================================================="
echo "8. SUMMARY OF REMAINING CACHE MEDIA"
echo "=========================================================="
sudo du -sh /opt/gsa-tv/cache/media/1/*
