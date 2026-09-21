#!/usr/bin/env bash
# ==============================================================================
# GSA TV — Audio Identity Inventory Validation Gate (Acceptance Gate 1)
# Path: infrastructure/gsa-tv/audio-identity/validate-audio-inventory.sh
# Usage: ./validate-audio-inventory.sh [--target <path>] [--min-files <N>] [--min-size <bytes>] [--json]
# ==============================================================================
set -euo pipefail

TARGET_DIR="/opt/gsa-tv/cache/media/1/identity/audio"
MIN_TOTAL_REQUIRED=200
MIN_BYTES_PER_FILE=4096
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
    --min-files=*)
      MIN_TOTAL_REQUIRED="${1#*=}"
      shift
      ;;
    --min-files)
      MIN_TOTAL_REQUIRED="$2"
      shift 2
      ;;
    --min-size=*)
      MIN_BYTES_PER_FILE="${1#*=}"
      shift
      ;;
    --min-size)
      MIN_BYTES_PER_FILE="$2"
      shift 2
      ;;
    -h|--help)
      cat <<USAGE_EOF
Usage: $(basename "$0") [OPTIONS] [TARGET_DIR]

Options:
  --target <path>      Directory containing audio category subfolders (default: $TARGET_DIR)
  --min-files <N>      Minimum required valid audio files across all categories (default: $MIN_TOTAL_REQUIRED)
  --min-size <bytes>   Minimum size in bytes to accept an audio file (default: $MIN_BYTES_PER_FILE)
  --json               Output report in JSON format
  -h, --help           Show this help message
USAGE_EOF
      exit 0
      ;;
    *)
      # Allow positional target dir if not starting with --
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
STATUS="PASS"
FAIL_REASONS=()

# Helper function to get file size safely across platforms
get_file_size() {
  local target_file="$1"
  local sz=0
  if sz=$(stat -c%s "$target_file" 2>/dev/null); then
    echo "$sz"
  elif sz=$(stat -f%z "$target_file" 2>/dev/null); then
    echo "$sz"
  elif sz=$(wc -c < "$target_file" 2>/dev/null); then
    echo "${sz//[[:space:]]/}"
  else
    echo 0
  fi
}

# 1. Base directory existence check
if [[ ! -d "$TARGET_DIR" ]]; then
  STATUS="FAIL"
  FAIL_REASONS+=("Base directory '$TARGET_DIR' does not exist")
fi

declare -A CATEGORY_COUNTS
declare -A CATEGORY_STUBS
declare -A CATEGORY_STATUS
TOTAL_VALID_COUNT=0
TOTAL_STUB_COUNT=0

for cat in "${REQUIRED_CATEGORIES[@]}"; do
  CAT_PATH="$TARGET_DIR/$cat"
  CATEGORY_COUNTS["$cat"]=0
  CATEGORY_STUBS["$cat"]=0
  
  if [[ ! -d "$CAT_PATH" ]]; then
    STATUS="FAIL"
    CATEGORY_STATUS["$cat"]="MISSING"
    FAIL_REASONS+=("Required category directory '$cat' is missing at '$CAT_PATH'")
  else
    CATEGORY_STATUS["$cat"]="EXISTS"
    CAT_VALID=0
    CAT_STUBS=0

    # Search for audio files (.mp3, .wav, .m4a)
    while IFS= read -r -d '' audio_file; do
      [[ -z "$audio_file" ]] && continue
      FILE_SIZE=$(get_file_size "$audio_file")
      
      if [[ "$FILE_SIZE" -lt "$MIN_BYTES_PER_FILE" ]]; then
        CAT_STUBS=$((CAT_STUBS + 1))
      else
        CAT_VALID=$((CAT_VALID + 1))
      fi
    done < <(find "$CAT_PATH" -maxdepth 1 -type f \( -iname "*.mp3" -o -iname "*.wav" -o -iname "*.m4a" \) -print0 2>/dev/null || true)

    CATEGORY_COUNTS["$cat"]=$CAT_VALID
    CATEGORY_STUBS["$cat"]=$CAT_STUBS
    TOTAL_VALID_COUNT=$((TOTAL_VALID_COUNT + CAT_VALID))
    TOTAL_STUB_COUNT=$((TOTAL_STUB_COUNT + CAT_STUBS))
  fi
done

# 2. Acceptance threshold check (>= 200 valid files)
if [[ "$TOTAL_VALID_COUNT" -lt "$MIN_TOTAL_REQUIRED" ]]; then
  STATUS="FAIL"
  FAIL_REASONS+=("Total valid audio files ($TOTAL_VALID_COUNT) is below required minimum ($MIN_TOTAL_REQUIRED)")
fi

# 3. Reject stub / empty files (< 4KB)
if [[ "$TOTAL_STUB_COUNT" -gt 0 ]]; then
  STATUS="FAIL"
  FAIL_REASONS+=("Found $TOTAL_STUB_COUNT corrupt/stub files under threshold size ($MIN_BYTES_PER_FILE bytes)")
fi

# 4. Output generation
if [[ "$JSON_MODE" = true ]]; then
  # Build JSON output safely using python3 if available, or manual escaping
  if command -v python3 >/dev/null 2>&1; then
    python3 - <<PYEOF
import json

reasons = []
PYEOF
    # Inject python code to dump json safely
    python3 - <<PYEOF
import json

reasons = """$(printf '%s\n' "${FAIL_REASONS[@]:-}")""".splitlines()
reasons = [r for r in reasons if r.strip()]

output = {
    "status": "$STATUS",
    "target_directory": "$TARGET_DIR",
    "required_min_files": int("$MIN_TOTAL_REQUIRED"),
    "total_valid_audio_files": int("$TOTAL_VALID_COUNT"),
    "corrupt_or_stub_files": int("$TOTAL_STUB_COUNT"),
    "min_size_bytes": int("$MIN_BYTES_PER_FILE"),
    "categories": {
        "news": {
            "status": "${CATEGORY_STATUS["news"]:-MISSING}",
            "valid_files": int("${CATEGORY_COUNTS["news"]:-0}"),
            "stub_files": int("${CATEGORY_STUBS["news"]:-0}")
        },
        "viral": {
            "status": "${CATEGORY_STATUS["viral"]:-MISSING}",
            "valid_files": int("${CATEGORY_COUNTS["viral"]:-0}"),
            "stub_files": int("${CATEGORY_STUBS["viral"]:-0}")
        },
        "faith": {
            "status": "${CATEGORY_STATUS["faith"]:-MISSING}",
            "valid_files": int("${CATEGORY_COUNTS["faith"]:-0}"),
            "stub_files": int("${CATEGORY_STUBS["faith"]:-0}")
        },
        "lifestyle": {
            "status": "${CATEGORY_STATUS["lifestyle"]:-MISSING}",
            "valid_files": int("${CATEGORY_COUNTS["lifestyle"]:-0}"),
            "stub_files": int("${CATEGORY_STUBS["lifestyle"]:-0}")
        },
        "sfx": {
            "status": "${CATEGORY_STATUS["sfx"]:-MISSING}",
            "valid_files": int("${CATEGORY_COUNTS["sfx"]:-0}"),
            "stub_files": int("${CATEGORY_STUBS["sfx"]:-0}")
        }
    },
    "reasons": reasons
}
print(json.dumps(output, indent=2))
PYEOF
  else
    # Fallback minimal JSON when python3 is not present
    echo "{"
    echo "  \"status\": \"$STATUS\","
    echo "  \"target_directory\": \"$TARGET_DIR\","
    echo "  \"required_min_files\": $MIN_TOTAL_REQUIRED,"
    echo "  \"total_valid_audio_files\": $TOTAL_VALID_COUNT,"
    echo "  \"corrupt_or_stub_files\": $TOTAL_STUB_COUNT,"
    echo "  \"categories\": {"
    echo "    \"news\": ${CATEGORY_COUNTS["news"]:-0},"
    echo "    \"viral\": ${CATEGORY_COUNTS["viral"]:-0},"
    echo "    \"faith\": ${CATEGORY_COUNTS["faith"]:-0},"
    echo "    \"lifestyle\": ${CATEGORY_COUNTS["lifestyle"]:-0},"
    echo "    \"sfx\": ${CATEGORY_COUNTS["sfx"]:-0}"
    echo "  }"
    echo "}"
  fi
else
  echo "================================================================================"
  echo "               GSA-TV SONIC IDENTITY INVENTORY VALIDATION REPORT                "
  echo "================================================================================"
  echo "Target Directory : $TARGET_DIR"
  echo "Minimum Required : $MIN_TOTAL_REQUIRED files across 5 categories"
  echo "Min File Size    : $MIN_BYTES_PER_FILE bytes (anti-stub threshold)"
  echo "Evaluation Date  : $(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date)"
  echo "--------------------------------------------------------------------------------"
  printf "%-15s | %-12s | %-12s | %-15s\n" "Category" "Valid Audio" "Stubs (<4KB)" "Directory Status"
  echo "--------------------------------------------------------------------------------"
  for cat in "${REQUIRED_CATEGORIES[@]}"; do
    printf "%-15s | %-12s | %-12s | %-15s\n" \
      "$cat" \
      "${CATEGORY_COUNTS[$cat]:-0}" \
      "${CATEGORY_STUBS[$cat]:-0}" \
      "${CATEGORY_STATUS[$cat]:-MISSING}"
  done
  echo "--------------------------------------------------------------------------------"
  echo "Total Valid Audio Files : $TOTAL_VALID_COUNT / $MIN_TOTAL_REQUIRED (Threshold requirement)"
  echo "Total Corrupt / Stubs   : $TOTAL_STUB_COUNT"
  echo "Overall Acceptance Gate : [ $STATUS ]"
  if [[ "$STATUS" != "PASS" ]]; then
    echo ""
    echo "Failures Detected:"
    for reason in "${FAIL_REASONS[@]}"; do
      echo "  - $reason"
    done
  fi
  echo "================================================================================"
fi

if [[ "$STATUS" = "PASS" ]]; then
  exit 0
else
  exit 1
fi
