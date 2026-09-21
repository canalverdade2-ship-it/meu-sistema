#!/usr/bin/env bash
# ==============================================================================
# GSA TV — Master Audio Identity Pipeline Runner
# Path: infrastructure/gsa-tv/audio-identity/run-audio-identity-pipeline.sh
# Target: Autonomous execution on Linux Oracle VPS (147.15.43.141)
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="${GSA_TV_AUDIO_ROOT:-/opt/gsa-tv/cache/media/1/identity/audio}"
STAGING_DIR="$TARGET_DIR/.staging"

echo "================================================================================"
echo "          GSA-TV SONIC IDENTITY AUTONOMOUS PIPELINE MASTER RUNNER              "
echo "================================================================================"
echo "Target Base Directory: $TARGET_DIR"
echo "Script Directory     : $SCRIPT_DIR"
echo "Execution Timestamp  : $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Step 1: Provision System Dependencies
echo ""
echo ">>> STEP 1: Provisioning dependencies..."
if [ -f "$SCRIPT_DIR/ensure-dependencies.sh" ]; then
  bash "$SCRIPT_DIR/ensure-dependencies.sh"
else
  echo "WARNING: ensure-dependencies.sh not found in $SCRIPT_DIR, checking PATH directly..."
fi

# Step 2: Ensure Directory Tree & Permissions
echo ""
echo ">>> STEP 2: Creating categorized directory structure..."
for cat in news viral faith lifestyle sfx; do
  mkdir -p "$TARGET_DIR/$cat"
done
mkdir -p "$STAGING_DIR"

if [ "$(id -u)" -eq 0 ] && id "gsa-tv" >/dev/null 2>&1; then
  chown -R gsa-tv:gsa-tv "$TARGET_DIR" || true
fi
chmod -R 0755 "$TARGET_DIR" || true

# Step 3: Run Acquisition Engine
echo ""
echo ">>> STEP 3: Executing audio acquisition engine (230 tracks)..."
node "$SCRIPT_DIR/acquire_identity_audio.mjs" --target="$TARGET_DIR" --staging="$STAGING_DIR" --concurrency=5

# Step 4: Acceptance Gate 1 — Inventory & Count Validation
echo ""
echo ">>> STEP 4: Validating audio inventory..."
if [ -f "$SCRIPT_DIR/validate-audio-inventory.sh" ]; then
  bash "$SCRIPT_DIR/validate-audio-inventory.sh" "$TARGET_DIR"
else
  echo "Running inline inventory count verification..."
  TOTAL_COUNT=$(find "$TARGET_DIR" -type f \( -iname "*.mp3" -o -iname "*.wav" -o -iname "*.m4a" \) | wc -l)
  echo "Total valid audio files found: $TOTAL_COUNT"
  for cat in news viral faith lifestyle sfx; do
    CAT_COUNT=$(find "$TARGET_DIR/$cat" -maxdepth 1 -type f \( -iname "*.mp3" -o -iname "*.wav" -o -iname "*.m4a" \) | wc -l)
    echo "  - Category $cat: $CAT_COUNT files"
    if [ "$CAT_COUNT" -eq 0 ]; then
      echo "ERROR: Category $cat has 0 files!" >&2
      exit 1
    fi
  done
  if [ "$TOTAL_COUNT" -lt 200 ]; then
    echo "ERROR: Total audio files ($TOTAL_COUNT) is below required minimum of 200!" >&2
    exit 1
  fi
fi

# Step 5: Acceptance Gate 2 — Forensic Audio Sample Verification
echo ""
echo ">>> STEP 5: Verifying audio samples integrity..."
if [ -f "$SCRIPT_DIR/verify-audio-samples.sh" ]; then
  bash "$SCRIPT_DIR/verify-audio-samples.sh" "$TARGET_DIR"
else
  echo "Running inline forensic sample check on 10 random files..."
  SAMPLE_COUNT=0
  find "$TARGET_DIR" -type f \( -iname "*.mp3" -o -iname "*.wav" \) | shuf -n 10 | while read -r sample_file; do
    SAMPLE_COUNT=$((SAMPLE_COUNT + 1))
    FILE_INFO=$(file -b "$sample_file")
    echo "  Sample [$SAMPLE_COUNT]: $(basename "$sample_file") -> $FILE_INFO"
    if command -v ffprobe >/dev/null 2>&1; then
      ffprobe -v error -show_entries format=duration,bit_rate -of default=noprint_wrappers=1 "$sample_file"
    fi
  done
fi

echo ""
echo "================================================================================"
echo "    SUCCESS: GSA-TV SONIC IDENTITY PIPELINE FULLY COMPLETED AND AUDITED!        "
echo "================================================================================"
exit 0
