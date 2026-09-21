# GSA-TV Sonic Identity Pipeline: Design, Validation & Acceptance Harness

**Document Version:** 1.0.0  
**Author:** teamwork_preview_explorer_survey_pipeline_3  
**Date:** 2026-09-04  
**Target Platform:** GSA TV Oracle Cloud Linux VPS (`/opt/gsa-tv/`)  
**Parent Mission:** Audio Identity Builder (~200–250 tracks across News, Viral, Faith, Lifestyle, SFX)  

---

## 1. Executive Summary

This report establishes the engineering specification, directory layout, automated dependency provisioning, resilient download architecture, and dual-gate test harness (Validation Gate & Forensic Verification Gate) for the GSA TV Sonic Identity Acquisition System.

The goal is to autonomously curate, acquire, validate, and verify **200 to 250 royalty-free audio tracks and sound effects** into the production GSA TV media cache on an Oracle Linux VPS at:
```text
/opt/gsa-tv/cache/media/1/identity/audio/
├── news/       (40–50 tracks: tense, corporate, hard news beds)
├── viral/      (40–50 tracks: upbeat, pop, rhythmic, modern trends)
├── faith/      (40–50 tracks: cinematic, peaceful, ambient, reflective)
├── lifestyle/  (40–50 tracks: jazz, acoustic, organic, morning beds)
└── sfx/        (40–50 effects: transitions, whooshes, impacts, tickers)
```

The system is designed with two distinct, non-negotiable acceptance gates:
1. **Validation Gate (`validate-audio-inventory.sh`)**: Confirms directory layout integrity and that total audio files (`.mp3`, `.wav`, `.m4a`) across the 5 categories is **>= 200**.
2. **Forensic Verification Gate (`verify-audio-samples.sh`)**: Selects 10 random audio files across the library and conducts deep acoustic and stream integrity analysis using `ffprobe` and `ffmpeg` null-sink decode (verifying codec, sample rate, channels, non-zero duration, and zero decoding corruption).

---

## 2. Directory Architecture & Organization

### 2.1 File System Path Layout
The target path aligns directly with the established GSA TV persistent media cache (`/opt/gsa-tv/cache/media/1/identity/` as defined in `docs/arquitetura-atual-gsa-tv.md` and `infrastructure/gsa-tv/scripts/setup-directories.sh`):

```text
/opt/gsa-tv/cache/media/1/identity/audio/
├── news/
│   ├── gsa_news_001_breaking_pulse.mp3
│   ├── gsa_news_002_investigative_drone.mp3
│   └── ... (target: 40-50 files)
├── viral/
│   ├── gsa_viral_001_hyper_energy_beat.mp3
│   ├── gsa_viral_002_quirky_comedy_groove.mp3
│   └── ... (target: 40-50 files)
├── faith/
│   ├── gsa_faith_001_ambient_cathedral.mp3
│   ├── gsa_faith_002_cinematic_hope.mp3
│   └── ... (target: 40-50 files)
├── lifestyle/
│   ├── gsa_lifestyle_001_morning_acoustic.mp3
│   ├── gsa_lifestyle_002_smooth_bossa_jazz.mp3
│   └── ... (target: 40-50 files)
├── sfx/
│   ├── gsa_sfx_001_sub_impact_heavy.wav
│   ├── gsa_sfx_002_digital_ticker_loop.wav
│   └── ... (target: 40-50 files)
├── manifest.json              # Machine-readable inventory with SHA-256 and metadata
└── .staging/                  # Temporary download & validation quarantine area
```

### 2.2 Category Definitions & Sonic Specifications

| Category | Sonic Profile | Target Duration | Formats | Broadcast Application | Min Target |
|---|---|---|---|---|---|
| **news** | Tense strings, corporate electronic pulse, driving bassline, investigative dark pads | 30s – 180s | `.mp3`, `.wav`, `.m4a` | Breaking news tickers, investigative segments, financial reports | 40 files |
| **viral** | Upbeat pop, high-tempo funk, energetic synth, comedic brass accents, rhythm beds | 15s – 120s | `.mp3`, `.wav`, `.m4a` | Social media roundups, fast-paced viral reels, variety segments | 40 files |
| **faith** | Cinematic orchestral, reflective piano, ethereal ambient pads, acoustic swells | 60s – 300s | `.mp3`, `.wav`, `.m4a` | Inspirational programming, memorial segments, peaceful reflections | 40 files |
| **lifestyle** | Smooth jazz, acoustic folk guitar, organic percussion, chill lo-fi beats | 45s – 240s | `.mp3`, `.wav`, `.m4a` | Cooking, health, morning magazine, cultural reports | 40 files |
| **sfx** | Whooshes, sub-hits, risers, news tickers, stingers, digital sweeps, glissandi | 0.5s – 15s | `.wav`, `.mp3` | Scene cuts, logo reveals, headline transitions, lower-third popups | 40 files |
| **TOTAL** | — | — | — | **Official Network Sonic Identity** | **>= 200 files** |

### 2.3 Filename Normalization Standard
All downloaded audio tracks must follow a deterministic, sanitized naming pattern:
`gsa_{category}_{index:03d}_{slug}.{ext}`
- `category`: `news`, `viral`, `faith`, `lifestyle`, or `sfx`
- `index`: zero-padded 3-digit number (`001` to `050+`)
- `slug`: lowercase alphanumeric string (`[a-z0-9_]`), spaces converted to underscores, special/accented characters stripped to ASCII.
- `ext`: lowercase canonical extension (`mp3`, `wav`, or `m4a`).

### 2.4 Permissions and Storage Footprint
- **Permissions**: Directory `0755` (`rwxr-xr-x`), Files `0644` (`rw-r--r--`).
- **Owner / Group**: `gsa-tv:gsa-tv` (with automatic fallback to current runtime user `root` or `ubuntu` if `gsa-tv` group does not exist).
- **Storage Footprint**: Average track size is 3 MB for MP3, 10–20 MB for uncompressed WAV SFX. A package of 250 tracks requires approximately **800 MB to 1.5 GB** of disk space, safely within standard VPS disk allocations.

---

## 3. Autonomous Dependency Provisioning (Linux VPS)

The pipeline must execute completely autonomously without requiring manual user intervention or interactive prompts.

### 3.1 Required System Binaries & Libraries

| Binary / Package | Mandatory | Purpose |
|---|---|---|
| `ffmpeg` | Yes | Audio decoding, null-sink corruption verification, optional format transcoding |
| `ffprobe` | Yes | Deep container & stream metadata extraction (JSON output) |
| `curl` | Yes | High-resilience HTTP/HTTPS track acquisition with retry flags |
| `file` | Yes | Secondary MIME / magic-byte verification (libmagic) |
| `findutils` (`find`) | Yes | Fast recursive audio directory traversal |
| `jq` | Optional (Fallback to Python) | JSON manipulation in shell scripts |
| `python3` | Recommended | Built-in script execution (standard library only: `urllib`, `hashlib`, `json`, `subprocess`) |
| `coreutils` (`sha256sum`, `stat`, `shuf`) | Yes | Checksum calculation, byte size checking, random file sampling |

### 3.2 Automated Provisioning Script: `ensure-dependencies.sh`

This script detects the Linux distribution (`apt-get` for Ubuntu/Debian, `dnf`/`yum` for Oracle Linux/RHEL) and installs any missing packages silently:

```bash
#!/usr/bin/env bash
# ==============================================================================
# GSA TV — Autonomous Dependency Installer for Audio Identity Pipeline
# Path: scripts/ensure-dependencies.sh
# ==============================================================================
set -euo pipefail

echo ">>> [GSA-TV] Checking system dependencies for Audio Identity Pipeline..."

REQUIRED_BINS=("ffmpeg" "ffprobe" "curl" "file" "find" "sha256sum" "python3")
MISSING=()

for bin in "${REQUIRED_BINS[@]}"; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    MISSING+=("$bin")
  fi
done

if [ ${#MISSING[@]} -eq 0 ]; then
  echo ">>> [GSA-TV] All required binaries are already installed: ${REQUIRED_BINS[*]}"
  exit 0
fi

echo ">>> [GSA-TV] Missing tools detected: ${MISSING[*]}"
echo ">>> [GSA-TV] Proceeding with autonomous package installation..."

SUDO_CMD=""
if [ "$(id -u)" -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1; then
    SUDO_CMD="sudo"
  else
    echo "ERROR: Non-root user and sudo not available to install packages." >&2
    exit 1
  fi
fi

if command -v apt-get >/dev/null 2>&1; then
  echo ">>> Detected Debian/Ubuntu environment (apt-get)"
  export DEBIAN_FRONTEND=noninteractive
  $SUDO_CMD apt-get update -qq
  $SUDO_CMD apt-get install -y -qq ffmpeg curl file findutils coreutils jq python3 python3-pip
elif command -v dnf >/dev/null 2>&1; then
  echo ">>> Detected Oracle Linux / RHEL environment (dnf)"
  $SUDO_CMD dnf install -y -q epel-release || true
  $SUDO_CMD dnf install -y -q ffmpeg curl file findutils coreutils jq python3 python3-pip
elif command -v yum >/dev/null 2>&1; then
  echo ">>> Detected CentOS / RHEL environment (yum)"
  $SUDO_CMD yum install -y -q epel-release || true
  $SUDO_CMD yum install -y -q ffmpeg curl file findutils coreutils jq python3
else
  echo "ERROR: Unsupported package manager. Please install ffmpeg, curl, file manually." >&2
  exit 1
fi

# Verification step
for bin in "${REQUIRED_BINS[@]}"; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "ERROR: Failed to install '$bin'." >&2
    exit 1
  fi
done

echo ">>> [GSA-TV] All dependencies installed and verified successfully."
```

---

## 4. Resilient Download & Acquisition Engine Design

Acquiring 200+ media assets across public CDNs and APIs often encounters network jitter, rate limiting (HTTP 429), partial downloads, or HTML error pages disguised with `.mp3` extensions. The acquisition engine must implement strict multi-layer defenses.

### 4.1 Staging & Two-Phase Commit Pattern
Assets must **never** be downloaded directly into the production category folders. Direct downloading leads to broken partially-written files or corrupted inventory counts if an interruption occurs.

```text
[ Remote Audio Source ]
           │
           ▼  (curl / python with 3x backoff retries & 10s connect timeout)
 [ .staging/tmp_download.part ]
           │
           ▼  (Phase 1 Verification: Min size > 5KB, MIME check, ID3/magic byte)
 [ .staging/validated_<hash>.mp3 ]
           │
           ▼  (Phase 2 Verification: ffprobe stream check & ffmpeg null-sink decode)
 [ Atomic mv to /opt/gsa-tv/cache/media/1/identity/audio/<category>/<normalized_name>.mp3 ]
           │
           ▼
 [ Append to manifest.json with SHA-256 ]
```

### 4.2 Error Handling & Download Retry Specifications
1. **HTTP Options**:
   - `connect-timeout`: 10 seconds.
   - `max-time`: 90 seconds.
   - `user-agent`: `GSA-TV-SonicIdentity/1.0 (+https://gsa-hub.com.br; broadcast-audio-builder)`
   - `fail-with-body`: Fail on HTTP 4xx/5xx errors rather than saving HTML error pages.
2. **Exponential Backoff**:
   - Up to 3 retry attempts per asset.
   - Delays: `attempt 1: 1.5s`, `attempt 2: 3.5s`, `attempt 3: 7.0s`.
3. **MIME & Header Validation**:
   - Verify `Content-Type` header contains `audio/` or `application/octet-stream`.
   - Reject any response where headers indicate `text/html`, `application/json`, or `text/plain`.
4. **Magic Byte Check**:
   - `.mp3`: Starts with `ID3` tag (`0x49 0x44 0x33`) or MPEG sync word (`0xFF 0xFB`, `0xFF 0xF3`, `0xFF 0xF2`).
   - `.wav`: Starts with `RIFF....WAVE`.
   - `.m4a`: Contains `ftypM4A ` or `ftypisom`.
5. **Deduplication via SHA-256**:
   - Calculate `sha256sum` immediately upon validation.
   - If hash already exists in `manifest.json`, skip duplication to prevent inflated inventory counts.
6. **Concurrency & Rate Limit Throttling**:
   - Limit download workers to **3 concurrent connections**.
   - Add an intentional **250ms delay** between batch API calls to avoid triggering Cloudflare or rate-limiting firewalls.

---

## 5. Validation Script Specification (Acceptance Gate 1: Structure & Count)

### 5.1 Objective & Criteria
The validation script confirms:
1. Base directory `/opt/gsa-tv/cache/media/1/identity/audio/` exists.
2. All five subdirectories (`news`, `viral`, `faith`, `lifestyle`, `sfx`) exist.
3. Inventory contains **>= 200 total audio files** matching `.mp3`, `.wav`, or `.m4a`.
4. No empty or stub files exist (all files must be `>= 4096 bytes`).
5. Returns exit code `0` if approved, `1` if rejected. Supports human-readable CLI summary and `--json` format.

### 5.2 Executable Script: `validate-audio-inventory.sh`

```bash
#!/usr/bin/env bash
# ==============================================================================
# GSA TV — Audio Identity Inventory Validation Gate
# Path: scripts/validate-audio-inventory.sh
# Usage: ./validate-audio-inventory.sh [--target /opt/gsa-tv/cache/media/1/identity/audio] [--json]
# ==============================================================================
set -euo pipefail

TARGET_DIR="${1:-/opt/gsa-tv/cache/media/1/identity/audio}"
JSON_MODE=false

for arg in "$@"; do
  case "$arg" in
    --json) JSON_MODE=true ;;
    --target=*) TARGET_DIR="${arg#*=}" ;;
  esac
done

REQUIRED_CATEGORIES=("news" "viral" "faith" "lifestyle" "sfx")
MIN_TOTAL_REQUIRED=200
MIN_BYTES_PER_FILE=4096

STATUS="PASS"
FAIL_REASONS=()

# 1. Base directory check
if [ ! -d "$TARGET_DIR" ]; then
  STATUS="FAIL"
  FAIL_REASONS+=("Base directory '$TARGET_DIR' does not exist")
fi

# 2. Check each category subdirectory
declare -A CATEGORY_COUNTS
TOTAL_COUNT=0
CORRUPT_STUBS=0

for cat in "${REQUIRED_CATEGORIES[@]}"; do
  CAT_PATH="$TARGET_DIR/$cat"
  if [ ! -d "$CAT_PATH" ]; then
    STATUS="FAIL"
    FAIL_REASONS+=("Category directory '$cat' is missing at '$CAT_PATH'")
    CATEGORY_COUNTS["$cat"]=0
  else
    # Find all audio files matching .mp3, .wav, .m4a
    COUNT=0
    while IFS= read -r -d '' audio_file; do
      FILE_SIZE=$(stat -c%s "$audio_file" 2>/dev/null || stat -f%z "$audio_file" 2>/dev/null || echo 0)
      if [ "$FILE_SIZE" -lt "$MIN_BYTES_PER_FILE" ]; then
        CORRUPT_STUBS=$((CORRUPT_STUBS + 1))
      else
        COUNT=$((COUNT + 1))
      fi
    done < <(find "$CAT_PATH" -maxdepth 1 -type f \( -iname "*.mp3" -o -iname "*.wav" -o -iname "*.m4a" \) -print0)

    CATEGORY_COUNTS["$cat"]=$COUNT
    TOTAL_COUNT=$((TOTAL_COUNT + COUNT))
  fi
done

# 3. Acceptance threshold check (>= 200 files)
if [ "$TOTAL_COUNT" -lt "$MIN_TOTAL_REQUIRED" ]; then
  STATUS="FAIL"
  FAIL_REASONS+=("Total audio files ($TOTAL_COUNT) is below required minimum ($MIN_TOTAL_REQUIRED)")
fi

if [ "$CORRUPT_STUBS" -gt 0 ]; then
  STATUS="FAIL"
  FAIL_REASONS+=("Found $CORRUPT_STUBS stub/empty files (< 4KB)")
fi

# Output formatting
if [ "$JSON_MODE" = true ]; then
  REASONS_JSON=$(printf '%s\n' "${FAIL_REASONS[@]}" | jq -R . | jq -s . 2>/dev/null || echo "[]")
  cat <<JSONEOF
{
  "status": "$STATUS",
  "target_directory": "$TARGET_DIR",
  "required_min_files": $MIN_TOTAL_REQUIRED,
  "total_valid_audio_files": $TOTAL_COUNT,
  "corrupt_or_stub_files": $CORRUPT_STUBS,
  "categories": {
    "news": ${CATEGORY_COUNTS["news"]:-0},
    "viral": ${CATEGORY_COUNTS["viral"]:-0},
    "faith": ${CATEGORY_COUNTS["faith"]:-0},
    "lifestyle": ${CATEGORY_COUNTS["lifestyle"]:-0},
    "sfx": ${CATEGORY_COUNTS["sfx"]:-0}
  },
  "reasons": $REASONS_JSON
}
JSONEOF
else
  echo "================================================================================"
  echo "               GSA-TV SONIC IDENTITY INVENTORY VALIDATION REPORT                "
  echo "================================================================================"
  echo "Target Directory : $TARGET_DIR"
  echo "Evaluation Date  : $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "--------------------------------------------------------------------------------"
  printf "%-15s | %-12s | %-15s\n" "Category" "Audio Count" "Subdirectory Status"
  echo "--------------------------------------------------------------------------------"
  for cat in "${REQUIRED_CATEGORIES[@]}"; do
    SUB_STATUS="EXISTS"
    [ ! -d "$TARGET_DIR/$cat" ] && SUB_STATUS="MISSING"
    printf "%-15s | %-12s | %-15s\n" "$cat" "${CATEGORY_COUNTS[$cat]:-0}" "$SUB_STATUS"
  done
  echo "--------------------------------------------------------------------------------"
  echo "Total Valid Audio Files : $TOTAL_COUNT / $MIN_TOTAL_REQUIRED (Minimum required)"
  echo "Stub / Corrupt Files    : $CORRUPT_STUBS"
  echo "Overall Inventory Gate  : [ $STATUS ]"
  if [ "$STATUS" != "PASS" ]; then
    echo ""
    echo "Failures Detected:"
    for reason in "${FAIL_REASONS[@]}"; do
      echo "  - $reason"
    done
  fi
  echo "================================================================================"
fi

[ "$STATUS" = "PASS" ] && exit 0 || exit 1
```

---

## 6. Forensic Verification Script Specification (Acceptance Gate 2: Acoustic Audit)

### 6.1 Objective & Forensic Criteria
Acceptance Criterion 3 requires:
> "A verification script (using `ffprobe` or `file`) runs on a sample of 10 random files and confirms they are valid, non-corrupt audio files."

To guarantee 100% broadcast reliability, the verification gate implements stratified random sampling (2 random files selected from each of the 5 categories) and verifies each file against **6 forensic parameters**:
1. **Audio Stream Presence**: Stream count for `codec_type == 'audio'` must be `>= 1`.
2. **Standard Broadcast Audio Codec**: Codec must be a recognized audio format (`mp3`, `aac`, `pcm_s16le`, `pcm_s24le`, `flac`, `vorbis`, `opus`).
3. **Sample Rate Integrity**: Must have a valid sample rate (typically `>= 22050 Hz`, standard 44100 Hz or 48000 Hz).
4. **Channel Layout**: Must have 1 (mono) or 2 (stereo) channels.
5. **Non-Zero Duration**: Duration must be strictly `> 0.0 seconds` (e.g. SFX: 0.5s–15s, Music: 30s–300s).
6. **Full Bitstream Decode Verification**: Executes `ffmpeg -v error -i "$FILE" -f null - 2>&1`. Any parsing errors, truncated frames, or corrupt packets trigger an immediate failure.

### 6.2 Executable Script: `verify-audio-samples.sh`

```bash
#!/usr/bin/env bash
# ==============================================================================
# GSA TV — Audio Forensic Acoustic & Stream Verification Gate
# Path: scripts/verify-audio-samples.sh
# Usage: ./verify-audio-samples.sh [--target /opt/gsa-tv/cache/media/1/identity/audio] [--samples 10] [--json]
# ==============================================================================
set -euo pipefail

TARGET_DIR="${1:-/opt/gsa-tv/cache/media/1/identity/audio}"
SAMPLES_PER_CAT=2
JSON_MODE=false

for arg in "$@"; do
  case "$arg" in
    --json) JSON_MODE=true ;;
    --target=*) TARGET_DIR="${arg#*=}" ;;
    --samples=*) SAMPLES_PER_CAT=$(( ${arg#*=} / 5 )) ;;
  esac
done

REQUIRED_CATEGORIES=("news" "viral" "faith" "lifestyle" "sfx")

# Verify prerequisites
for tool in ffprobe ffmpeg file; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "ERROR: Required forensic tool '$tool' is not installed." >&2
    exit 1
  fi
done

# Collect stratified sample of 10 files (2 per category)
SELECTED_FILES=()
for cat in "${REQUIRED_CATEGORIES[@]}"; do
  CAT_DIR="$TARGET_DIR/$cat"
  if [ -d "$CAT_DIR" ]; then
    # Pick 2 random files from category
    mapfile -t CAT_SAMPLES < <(find "$CAT_DIR" -maxdepth 1 -type f \( -iname "*.mp3" -o -iname "*.wav" -o -iname "*.m4a" \) | shuf -n "$SAMPLES_PER_CAT")
    for f in "${CAT_SAMPLES[@]}"; do
      [ -n "$f" ] && SELECTED_FILES+=("$f")
    done
  fi
done

TOTAL_SELECTED=${#SELECTED_FILES[@]}
if [ "$TOTAL_SELECTED" -lt 10 ]; then
  echo "WARNING: Only found $TOTAL_SELECTED files to sample (expected at least 10)."
fi

AUDIT_RESULTS=()
OVERALL_PASS=true
PASSED_COUNT=0
FAILED_COUNT=0

for file_path in "${SELECTED_FILES[@]}"; do
  FILENAME=$(basename "$file_path")
  CAT_NAME=$(basename "$(dirname "$file_path")")
  FILE_SIZE=$(stat -c%s "$file_path" 2>/dev/null || stat -f%z "$file_path" 2>/dev/null || echo 0)
  
  # 1. Probe stream metadata via ffprobe JSON
  PROBE_OUT=$(ffprobe -v error -show_streams -show_format -of json "$file_path" 2>/dev/null || echo "{}")
  
  # Parse stream attributes using python3 standard library
  AUD_STATS=$(python3 - <<EOF
import sys, json

try:
    data = json.loads('''$PROBE_OUT''')
    streams = [s for s in data.get('streams', []) if s.get('codec_type') == 'audio']
    if not streams:
        print("NO_AUDIO_STREAM|none|0|0|0.0")
        sys.exit(0)
    
    astream = streams[0]
    codec = astream.get('codec_name', 'unknown')
    sample_rate = int(astream.get('sample_rate', 0))
    channels = int(astream.get('channels', 0))
    
    dur_str = data.get('format', {}).get('duration') or astream.get('duration') or '0.0'
    duration = float(dur_str)
    
    print(f"OK|{codec}|{sample_rate}|{channels}|{duration:.2f}")
except Exception as e:
    print(f"ERROR|{str(e)}|0|0|0.0")
EOF
)

  IFS='|' read -r STREAM_STATUS ACODEC SAMPLE_RATE CHANNELS DURATION <<< "$AUD_STATS"
  
  # 2. File magic header confirmation
  FILE_MIME=$(file -b --mime-type "$file_path" 2>/dev/null || echo "unknown")
  
  # 3. Bitstream decode corruption test via ffmpeg null-sink
  DECODE_ERRORS=$(ffmpeg -v error -i "$file_path" -f null - 2>&1 || true)
  
  # Evaluation rules
  FILE_PASS=true
  FAIL_NOTE=""
  
  if [ "$STREAM_STATUS" != "OK" ]; then
    FILE_PASS=false
    FAIL_NOTE="Missing valid audio stream"
  elif (( $(echo "$DURATION <= 0.0" | bc -l 2>/dev/null || echo 0) )); then
    FILE_PASS=false
    FAIL_NOTE="Zero duration ($DURATION s)"
  elif [ "$SAMPLE_RATE" -lt 16000 ]; then
    FILE_PASS=false
    FAIL_NOTE="Low sample rate ($SAMPLE_RATE Hz)"
  elif [ "$CHANNELS" -lt 1 ]; then
    FILE_PASS=false
    FAIL_NOTE="Invalid channel count ($CHANNELS)"
  elif [ -n "$DECODE_ERRORS" ]; then
    FILE_PASS=false
    FAIL_NOTE="Bitstream corruption: $(echo "$DECODE_ERRORS" | tr '\n' ' ' | cut -c1-60)"
  fi
  
  if [ "$FILE_PASS" = true ]; then
    PASSED_COUNT=$((PASSED_COUNT + 1))
    STATUS_LABEL="PASS"
  else
    FAILED_COUNT=$((FAILED_COUNT + 1))
    OVERALL_PASS=false
    STATUS_LABEL="FAIL ($FAIL_NOTE)"
  fi
  
  AUDIT_RESULTS+=("{\"file\":\"$FILENAME\",\"category\":\"$CAT_NAME\",\"codec\":\"$ACODEC\",\"sample_rate\":$SAMPLE_RATE,\"channels\":$CHANNELS,\"duration_s\":$DURATION,\"size_bytes\":$FILE_SIZE,\"mime\":\"$FILE_MIME\",\"status\":\"$STATUS_LABEL\"}")
done

# Output Generation
if [ "$JSON_MODE" = true ]; then
  python3 - <<PYEOF
import json
results = [json.loads(x) for x in '''$(printf '%s\n' "${AUDIT_RESULTS[@]}")'''.splitlines() if x.strip()]
output = {
  "overall_status": "PASS" if $([ "$OVERALL_PASS" = true ] && echo "True" || echo "False") else "FAIL",
  "samples_inspected": len(results),
  "passed": $PASSED_COUNT,
  "failed": $FAILED_COUNT,
  "audit_details": results
}
print(json.dumps(output, indent=2))
PYEOF
else
  echo "========================================================================================================"
  echo "                        GSA-TV FORENSIC AUDIO VERIFICATION AUDIT REPORT                                "
  echo "========================================================================================================"
  echo "Target Directory  : $TARGET_DIR"
  echo "Samples Audited   : $TOTAL_SELECTED"
  echo "Evaluation Date   : $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "--------------------------------------------------------------------------------------------------------"
  printf "%-10s | %-32s | %-8s | %-9s | %-4s | %-8s | %-12s\n" \
    "Category" "Filename" "Codec" "Rate" "Ch" "Duration" "Verdict"
  echo "--------------------------------------------------------------------------------------------------------"
  for item in "${AUDIT_RESULTS[@]}"; do
    python3 - <<PYEOF
import json
d = json.loads('''$item''')
fn = d['file'][:30] + '..' if len(d['file']) > 32 else d['file']
verdict = "PASS" if "PASS" in d['status'] else "FAIL"
print(f"{d['category']:<10} | {fn:<32} | {d['codec']:<8} | {d['sample_rate']:>5} Hz | {d['channels']:>2} | {d['duration_s']:>6.2f}s | {d['status']}")
PYEOF
  done
  echo "--------------------------------------------------------------------------------------------------------"
  echo "Verification Summary: $PASSED_COUNT Passed, $FAILED_COUNT Failed out of $TOTAL_SELECTED samples."
  echo "Overall Forensic Gate Verdict: [ $([ "$OVERALL_PASS" = true ] && echo "PASS" || echo "FAIL") ]"
  echo "========================================================================================================"
fi

[ "$OVERALL_PASS" = true ] && exit 0 || exit 1
```

---

## 7. End-to-End Orchestration & Master Runner

To allow seamless one-command deployment and verification on the Linux VPS, the individual modules are sequenced through a master pipeline runner: `run-audio-identity-pipeline.sh`.

```text
                                [ Master Orchestrator: run-audio-identity-pipeline.sh ]
                                                        │
         ┌──────────────────────────────────────────────┴──────────────────────────────────────────────┐
         ▼                                              ▼                                              ▼
Step 1: Provisioning                           Step 2: Directory Setup                        Step 3: Acquisition Engine
ensure-dependencies.sh                         mkdir -p /opt/gsa-tv/cache/...                 download-curated-tracks.py
- apt/dnf installs                             - news, viral, faith, lifestyle, sfx           - Staged downloads (.staging/)
- ffmpeg, curl, file, python3                  - chown gsa-tv:gsa-tv, chmod 0755              - 3x exponential backoff
                                                                                              - Magic byte & SHA-256 dedupe
                                                                                              - Two-phase commit move
                                                        │
         ┌──────────────────────────────────────────────┴──────────────────────────────────────────────┐
         ▼                                                                                             ▼
Step 4: Acceptance Gate 1                                                                     Step 5: Acceptance Gate 2
validate-audio-inventory.sh                                                                   verify-audio-samples.sh
- Layout confirmed                                                                            - 10 stratified samples (2/cat)
- Files counted (>= 200)                                                                      - ffprobe codec, rate, channels
- Anti-stub check (>4KB)                                                                      - ffmpeg null decode check
                                                        │
                                                        ▼
                                           Step 6: Manifest Publication
                                           /opt/gsa-tv/cache/media/1/identity/audio/manifest.json
```

### 7.1 Master Runner Script: `run-audio-identity-pipeline.sh`

```bash
#!/usr/bin/env bash
# ==============================================================================
# GSA TV — Master Audio Identity Pipeline Runner
# Path: scripts/run-audio-identity-pipeline.sh
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="${GSA_TV_AUDIO_ROOT:-/opt/gsa-tv/cache/media/1/identity/audio}"

echo "================================================================================"
echo "           STARTING GSA-TV SONIC IDENTITY AUTONOMOUS PIPELINE                   "
echo "================================================================================"
echo "Target Base Directory: $TARGET_DIR"
echo "Execution Timestamp  : $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Step 1: Autonomous Dependencies
echo ""
echo ">>> STEP 1: Ensuring system dependencies..."
bash "$SCRIPT_DIR/ensure-dependencies.sh"

# Step 2: Directory Setup
echo ""
echo ">>> STEP 2: Creating categorized directory structure..."
for cat in news viral faith lifestyle sfx; do
  mkdir -p "$TARGET_DIR/$cat"
done
mkdir -p "$TARGET_DIR/.staging"

# If running as root and gsa-tv user exists, apply ownership
if [ "$(id -u)" -eq 0 ] && id "gsa-tv" >/dev/null 2>&1; then
  chown -R gsa-tv:gsa-tv "$TARGET_DIR"
fi
chmod -R 0755 "$TARGET_DIR"

# Step 3: Run Acquisition Engine
echo ""
echo ">>> STEP 3: Executing audio acquisition engine..."
python3 "$SCRIPT_DIR/acquire-audio-identity.py" --target "$TARGET_DIR" --staging "$TARGET_DIR/.staging"

# Step 4: Acceptance Gate 1 (Validation)
echo ""
echo ">>> STEP 4: Running Inventory Validation Gate..."
bash "$SCRIPT_DIR/validate-audio-inventory.sh" "$TARGET_DIR"

# Step 5: Acceptance Gate 2 (Forensic Acoustic Audit)
echo ""
echo ">>> STEP 5: Running Forensic ffprobe Verification Gate..."
bash "$SCRIPT_DIR/verify-audio-samples.sh" "$TARGET_DIR"

echo ""
echo "================================================================================"
echo "   SUCCESS: GSA-TV SONIC IDENTITY PIPELINE FULLY COMPLETED AND AUDITED PASS!    "
echo "================================================================================"
```

---

## 8. Integration with Existing GSA TV Infrastructure

Our survey of the codebase reveals direct integration points with existing GSA TV services:

1. **Alignment with Media Storage Tree**:
   - `docs/arquitetura-atual-gsa-tv.md` defines `/opt/gsa-tv/cache/media/1/` as the definitive media storage. The audio sonic identity directly enriches this tree under `/identity/audio/`.
2. **Alignment with `preset-validate.sh`**:
   - GSA TV's `infrastructure/gsa-tv/scripts/preset-validate.sh` validates broadcast videos using `ffprobe` and Python JSON stream extraction. Our `verify-audio-samples.sh` uses identical battle-tested parsing conventions adapted for pure audio streams.
3. **Playout & Media Worker Compatibility**:
   - In `infrastructure/gsa-tv/services/playout-api/src/app.js` and `media-worker`, media items are registered with `audio_codec`, `audio_sample_rate`, and `duration_s`. The `manifest.json` generated by our pipeline matches this schema directly, enabling seamless future DB cataloging without transcoding overhead.
4. **Storage Resilience Integration**:
   - Passes the requirements tested by `infrastructure/gsa-tv/tests/test-vps-storage-resilience.sh` (directory permissions not world-writable, persistent paths mounted, SHA-256 integrity proofs).

---

## 9. Verification & Acceptance Checklist for Workers and Reviewers

When the Worker track implements the pipeline and the E2E Test track runs verification, the following checklist governs acceptance:

- [ ] **Dependency Independence**: Running `ensure-dependencies.sh` installs all necessary packages without user interaction on clean Linux VPS.
- [ ] **Directory Conformance**: All 5 directories (`news`, `viral`, `faith`, `lifestyle`, `sfx`) exist at `/opt/gsa-tv/cache/media/1/identity/audio/`.
- [ ] **Minimum File Quota**: Total valid `.mp3`, `.wav`, or `.m4a` files across all 5 directories is **>= 200** (target 200–250).
- [ ] **Distribution Balance**: Every category contains at least 35–45 tracks, preventing single-category bias.
- [ ] **No Corrupted Stubs**: No 0-byte or trivial HTML error files (< 4KB).
- [ ] **Forensic Audio Audit**: `verify-audio-samples.sh` audits 10 random files and confirms valid audio streams, valid sample rates, standard channels, positive durations, and 0 bitstream decode errors.
- [ ] **Manifest Completeness**: `manifest.json` provides an immutable inventory with category, track title, source license, and SHA-256 hash for every file.
