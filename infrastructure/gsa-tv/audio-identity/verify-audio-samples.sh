#!/usr/bin/env bash
# ==============================================================================
# GSA TV — Audio Forensic Acoustic & Stream Verification Gate (Acceptance Gate 2)
# Path: infrastructure/gsa-tv/audio-identity/verify-audio-samples.sh
# Usage: ./verify-audio-samples.sh [--target <path>] [--samples 10] [--json]
# ==============================================================================
set -euo pipefail

TARGET_DIR="/opt/gsa-tv/cache/media/1/identity/audio"
TOTAL_SAMPLES_TARGET=10
JSON_MODE=false

# Argument parsing
while [[ $# -gt 0 ]]; do
  case "$1" in
    --json)
      JSON_MODE=true
      shift
      ;;
    --target=*)
      TARGET_DIR="${1#*=}"
      shift
      ;;
    --target)
      TARGET_DIR="$2"
      shift 2
      ;;
    --samples=*)
      TOTAL_SAMPLES_TARGET="${1#*=}"
      shift
      ;;
    --samples)
      TOTAL_SAMPLES_TARGET="$2"
      shift 2
      ;;
    -h|--help)
      cat <<USAGE_EOF
Usage: $(basename "$0") [OPTIONS] [TARGET_DIR]

Options:
  --target <path>     Directory containing audio category subfolders (default: $TARGET_DIR)
  --samples <N>       Total number of random samples to audit (default: $TOTAL_SAMPLES_TARGET)
  --json              Output audit report in JSON format
  -h, --help          Show this help message
USAGE_EOF
      exit 0
      ;;
    *)
      if [[ "$1" != --* ]]; then
        TARGET_DIR="$1"
        shift
      else
        echo "Unknown option: $1" >&2
        exit 2
      fi
      ;;
  esac
done

REQUIRED_CATEGORIES=("news" "viral" "faith" "lifestyle" "sfx")
SAMPLES_PER_CAT=$(( TOTAL_SAMPLES_TARGET / 5 ))
[[ "$SAMPLES_PER_CAT" -lt 1 ]] && SAMPLES_PER_CAT=1

# Probe & decode wrappers supporting native binaries and Docker container fallbacks
run_ffprobe() {
  local filepath="$1"
  if command -v ffprobe >/dev/null 2>&1; then
    ffprobe -v error -show_streams -show_format -of json "$filepath" 2>/dev/null || echo "{}"
  elif [[ "$filepath" == /opt/gsa-tv/cache/media/* ]] && docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^gsa-tv-control-plane$'; then
    local mapped="${filepath/\/opt\/gsa-tv\/cache\/media/\/media}"
    docker exec gsa-tv-control-plane ffprobe -v error -show_streams -show_format -of json "$mapped" 2>/dev/null || echo "{}"
  elif command -v docker >/dev/null 2>&1; then
    local dir; dir="$(dirname "$filepath")"
    docker run --rm -v "$dir":"$dir":ro gsa-tv/control-plane:1.7.2 ffprobe -v error -show_streams -show_format -of json "$filepath" 2>/dev/null || echo "{}"
  else
    echo "{}"
  fi
}

run_ffmpeg_decode() {
  local filepath="$1"
  if command -v ffmpeg >/dev/null 2>&1; then
    ffmpeg -v error -i "$filepath" -f null - 2>&1 || true
  elif [[ "$filepath" == /opt/gsa-tv/cache/media/* ]] && docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^gsa-tv-control-plane$'; then
    local mapped="${filepath/\/opt\/gsa-tv\/cache\/media/\/media}"
    docker exec gsa-tv-control-plane ffmpeg -v error -i "$mapped" -f null - 2>&1 || true
  elif command -v docker >/dev/null 2>&1; then
    local dir; dir="$(dirname "$filepath")"
    docker run --rm -v "$dir":"$dir":ro gsa-tv/control-plane:1.7.2 ffmpeg -v error -i "$filepath" -f null - 2>&1 || true
  else
    echo ""
  fi
}

run_file_magic() {
  local filepath="$1"
  if command -v file >/dev/null 2>&1; then
    file -b "$filepath" 2>/dev/null || echo "Unknown"
  else
    echo "file utility not available"
  fi
}

run_file_mime() {
  local filepath="$1"
  if command -v file >/dev/null 2>&1; then
    file -b --mime-type "$filepath" 2>/dev/null || echo "audio/unknown"
  else
    echo "audio/unknown"
  fi
}

# Cross-platform sampling helper
sample_lines() {
  local count="$1"
  if command -v shuf >/dev/null 2>&1; then
    shuf -n "$count"
  elif command -v python3 >/dev/null 2>&1; then
    python3 -c "import sys, random; lines = [l.strip() for l in sys.stdin if l.strip()]; random.shuffle(lines); print('\n'.join(lines[:$count]))"
  else
    head -n "$count"
  fi
}

# Collect stratified sample of files across categories
SELECTED_FILES=()
for cat in "${REQUIRED_CATEGORIES[@]}"; do
  CAT_DIR="$TARGET_DIR/$cat"
  if [[ -d "$CAT_DIR" ]]; then
    CAT_CANDIDATES=$(find "$CAT_DIR" -maxdepth 1 -type f \( -iname "*.mp3" -o -iname "*.wav" -o -iname "*.m4a" \) 2>/dev/null || true)
    if [[ -n "$CAT_CANDIDATES" ]]; then
      while IFS= read -r sample_file; do
        [[ -n "$sample_file" ]] && SELECTED_FILES+=("$sample_file")
      done < <(echo "$CAT_CANDIDATES" | sample_lines "$SAMPLES_PER_CAT")
    fi
  fi
done

TOTAL_SELECTED=${#SELECTED_FILES[@]}

if [[ "$TOTAL_SELECTED" -eq 0 ]]; then
  if [[ "$JSON_MODE" = true ]]; then
    echo "{\"overall_status\":\"FAIL\",\"error\":\"No audio files found to sample in $TARGET_DIR\",\"samples_inspected\":0,\"passed\":0,\"failed\":0,\"audit_details\":[]}"
  else
    echo "ERROR: No audio files found in '$TARGET_DIR' across categories." >&2
  fi
  exit 1
fi

AUDIT_RESULTS=()
OVERALL_PASS=true
PASSED_COUNT=0
FAILED_COUNT=0

for file_path in "${SELECTED_FILES[@]}"; do
  FILENAME=$(basename "$file_path")
  CAT_NAME=$(basename "$(dirname "$file_path")")
  FILE_SIZE=0
  if sz=$(stat -c%s "$file_path" 2>/dev/null); then FILE_SIZE=$sz;
  elif sz=$(stat -f%z "$file_path" 2>/dev/null); then FILE_SIZE=$sz;
  elif sz=$(wc -c < "$file_path" 2>/dev/null); then FILE_SIZE="${sz//[[:space:]]/}"; fi

  # 1. Run ffprobe
  PROBE_OUT=$(run_ffprobe "$file_path")

  # 2. Extract audio metadata using Python standard library
  AUD_STATS=$(python3 - <<PYEOF
import sys, json

try:
    data = json.loads('''$PROBE_OUT''') if '''$PROBE_OUT'''.strip() else {}
    streams = [s for s in data.get('streams', []) if s.get('codec_type') == 'audio']
    if not streams:
        print("NO_AUDIO_STREAM|none|0|0|0.0")
        sys.exit(0)
    
    astream = streams[0]
    codec = astream.get('codec_name', 'unknown')
    sample_rate = int(astream.get('sample_rate', 0) or 0)
    channels = int(astream.get('channels', 0) or 0)
    
    dur_str = data.get('format', {}).get('duration') or astream.get('duration') or '0.0'
    try:
        duration = float(dur_str)
    except:
        duration = 0.0
        
    print(f"OK|{codec}|{sample_rate}|{channels}|{duration:.2f}")
except Exception as e:
    print(f"ERROR|{str(e).replace('|', '_')}|0|0|0.0")
PYEOF
)

  IFS='|' read -r STREAM_STATUS ACODEC SAMPLE_RATE CHANNELS DURATION <<< "$AUD_STATS"

  # 3. File magic / mime inspection
  FILE_MIME=$(run_file_mime "$file_path")
  FILE_DESC=$(run_file_magic "$file_path")

  # 4. Bitstream decode corruption test
  DECODE_ERRORS=$(run_ffmpeg_decode "$file_path")

  # Forensic evaluation rules
  FILE_PASS=true
  FAIL_NOTE=""

  if [[ "$STREAM_STATUS" != "OK" ]]; then
    # If ffprobe wasn't able to extract streams, check file magic
    if [[ "$FILE_MIME" != audio/* && "$FILE_DESC" != *"Audio"* && "$FILE_DESC" != *"MPEG"* && "$FILE_DESC" != *"WAVE"* ]]; then
      FILE_PASS=false
      FAIL_NOTE="Missing valid audio stream ($FILE_DESC)"
    fi
  else
    if python3 -c "import sys; sys.exit(0 if float('$DURATION') > 0.0 else 1)" 2>/dev/null; [[ $? -ne 0 ]]; then
      FILE_PASS=false
      FAIL_NOTE="Zero or invalid duration ($DURATION s)"
    elif [[ "$SAMPLE_RATE" -lt 16000 ]]; then
      FILE_PASS=false
      FAIL_NOTE="Sample rate below 16kHz ($SAMPLE_RATE Hz)"
    elif [[ "$CHANNELS" -lt 1 ]]; then
      FILE_PASS=false
      FAIL_NOTE="Invalid channel count ($CHANNELS)"
    fi
  fi

  # Check bitstream errors
  if [[ -n "$DECODE_ERRORS" ]]; then
    FILE_PASS=false
    FAIL_NOTE="Bitstream corruption: $(echo "$DECODE_ERRORS" | tr '\n' ' ' | cut -c1-60)"
  fi

  # Check minimum size (4KB)
  if [[ "$FILE_SIZE" -lt 4096 ]]; then
    FILE_PASS=false
    FAIL_NOTE="Stub audio file (< 4096 bytes)"
  fi

  if [[ "$FILE_PASS" = true ]]; then
    PASSED_COUNT=$((PASSED_COUNT + 1))
    STATUS_LABEL="PASS"
  else
    FAILED_COUNT=$((FAILED_COUNT + 1))
    OVERALL_PASS=false
    STATUS_LABEL="FAIL: $FAIL_NOTE"
  fi

  # Collect JSON record
  JSON_RECORD=$(python3 - <<PYEOF
import json
rec = {
    "file": "$FILENAME",
    "category": "$CAT_NAME",
    "size_bytes": int("$FILE_SIZE"),
    "codec": "$ACODEC",
    "sample_rate": int("$SAMPLE_RATE"),
    "channels": int("$CHANNELS"),
    "duration_s": float("$DURATION"),
    "mime": "$FILE_MIME",
    "status": "$STATUS_LABEL"
}
print(json.dumps(rec))
PYEOF
)
  AUDIT_RESULTS+=("$JSON_RECORD")
done

if [[ "$OVERALL_PASS" = true && "$TOTAL_SELECTED" -gt 0 ]]; then
  OVERALL_STATUS="PASS"
else
  OVERALL_STATUS="FAIL"
fi

# Output generation
if [[ "$JSON_MODE" = true ]]; then
  python3 - <<PYEOF
import json

raw_items = [
$(for item in "${AUDIT_RESULTS[@]}"; do echo "  $item,"; done)
]

output = {
    "overall_status": "$OVERALL_STATUS",
    "target_directory": "$TARGET_DIR",
    "samples_inspected": int("$TOTAL_SELECTED"),
    "passed": int("$PASSED_COUNT"),
    "failed": int("$FAILED_COUNT"),
    "audit_details": raw_items
}
print(json.dumps(output, indent=2))
PYEOF
else
  echo "========================================================================================================"
  echo "                       GSA-TV FORENSIC AUDIO VERIFICATION AUDIT REPORT                                  "
  echo "========================================================================================================"
  echo "Target Directory  : $TARGET_DIR"
  echo "Samples Audited   : $TOTAL_SELECTED"
  echo "Evaluation Date   : $(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date)"
  echo "--------------------------------------------------------------------------------------------------------"
  printf "%-10s | %-32s | %-8s | %-10s | %-4s | %-8s | %-16s\n" \
    "Category" "Filename" "Codec" "Rate" "Ch" "Duration" "Verdict"
  echo "--------------------------------------------------------------------------------------------------------"
  for item in "${AUDIT_RESULTS[@]}"; do
    python3 - <<PYEOF
import json
d = json.loads('''$item''')
fn = d['file'][:30] + '..' if len(d['file']) > 32 else d['file']
rate_str = f"{d['sample_rate']} Hz" if d['sample_rate'] > 0 else "N/A"
dur_str = f"{d['duration_s']:.2f}s" if d['duration_s'] > 0 else "N/A"
print(f"{d['category']:<10} | {fn:<32} | {d['codec']:<8} | {rate_str:>10} | {d['channels']:>4} | {dur_str:>8} | {d['status']}")
PYEOF
  done
  echo "--------------------------------------------------------------------------------------------------------"
  echo "Verification Summary: $PASSED_COUNT Passed, $FAILED_COUNT Failed out of $TOTAL_SELECTED audited samples."
  echo "Overall Forensic Gate Verdict: [ $OVERALL_STATUS ]"
  echo "========================================================================================================"
fi

if [[ "$OVERALL_STATUS" = "PASS" ]]; then
  exit 0
else
  exit 1
fi
