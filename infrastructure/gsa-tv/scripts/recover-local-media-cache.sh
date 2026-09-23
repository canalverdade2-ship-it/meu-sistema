#!/usr/bin/env bash
# Recover only deterministic local media matches into the expected /media/1 cache.
# Dry-run by default. The script never deletes or overwrites an existing target.
set -euo pipefail

APPLY=false
BASE="${GSA_TV_BASE:-/opt/gsa-tv}"
ENV_FILE="${GSA_TV_ENV_FILE:-$BASE/control-plane/.env}"
CACHE_ROOT="${GSA_TV_MEDIA_CACHE_ROOT:-$BASE/cache/media}"
RUNTIME_DIR="${GSA_TV_RUNTIME_DIR:-$BASE/runtime}"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --apply) APPLY=true ;;
    -h|--help) echo "Usage: recover-local-media-cache.sh [--apply]"; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; exit 64 ;;
  esac
  shift
done

command -v psql >/dev/null
command -v python3 >/dev/null
[ -f "$ENV_FILE" ] || { echo "BLOCKED: env file missing" >&2; exit 78; }
DB_URL="$(awk -F= '$1=="DATABASE_URL"{sub(/^[^=]*=/,"");print;exit}' "$ENV_FILE")"
[ -n "$DB_URL" ] || { echo "BLOCKED: DATABASE_URL missing" >&2; exit 78; }

catalog_file="$(mktemp)"
plan_file="$(mktemp)"
missing_file="$(mktemp)"
trap 'rm -f "$catalog_file" "$plan_file" "$missing_file"' EXIT

psql "$DB_URL" -X -qAt -F '|' -v ON_ERROR_STOP=1 -c "
select id,
       drive_path,
       coalesce(metadata->>'sha256','')
  from public.gsa_tv_media_items
 where drive_path like '/media/1/%'
 order by id
" > "$catalog_file"

python3 - "$catalog_file" "$plan_file" "$missing_file" <<'PY'
import hashlib
import os
import re
import sys

catalog_path, plan_path, missing_path = sys.argv[1:4]
roots = [
    "/opt/gsa-tv/backups/production-editions",
    "/opt/gsa-tv/fallback",
    "/home/opc/gsa-ai",
    "/home/opc/gsa-program-builder",
    "/opt/gsa-tv/preview",
]
exts = {".mp4", ".mov", ".mkv", ".webm", ".wav", ".mp3"}
index = {}

for root in roots:
    if not os.path.isdir(root):
        continue
    for base, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in {".git", "node_modules", ".npm", ".cache"}]
        for name in files:
            if os.path.splitext(name)[1].lower() not in exts:
                continue
            full = os.path.join(base, name)
            keys = [name]
            m = re.match(r"^[0-9a-f]{16}-(.+)$", name, re.I)
            if m:
                keys.append(m.group(1))
            for key in keys:
                index.setdefault(key, []).append(full)

def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

planned = []
missing = []
with open(catalog_path, encoding="utf-8") as f:
    for line in f:
        line = line.rstrip("\n")
        if not line:
            continue
        media_id, drive_path, expected_sha = (line.split("|", 2) + ["", ""])[:3]
        basename = os.path.basename(drive_path)
        candidates = sorted(set(index.get(basename, [])))
        if expected_sha:
            candidates = [p for p in candidates if sha256(p).lower() == expected_sha.lower()]
        if len(candidates) == 1:
            planned.append((media_id, drive_path, candidates[0], expected_sha))
        else:
            missing.append((media_id, drive_path, str(len(candidates))))

with open(plan_path, "w", encoding="utf-8") as f:
    for row in planned:
        f.write("|".join(row) + "\n")
with open(missing_path, "w", encoding="utf-8") as f:
    for row in missing:
        f.write("|".join(row) + "\n")

print(f"RECOVERY_CATALOG_TOTAL={len(planned)+len(missing)}")
print(f"RECOVERY_DETERMINISTIC_MATCHES={len(planned)}")
print(f"RECOVERY_UNRESOLVED={len(missing)}")
PY

planned_count="$(wc -l < "$plan_file" | tr -d ' ')"
missing_count="$(wc -l < "$missing_file" | tr -d ' ')"
echo "RECOVERY_PLAN_BEGIN"
echo "apply=$APPLY"
echo "deterministic_matches=$planned_count"
echo "unresolved=$missing_count"
sed 's/^/RECOVER=/' "$plan_file" | head -100
echo "RECOVERY_PLAN_END"

if [ "$APPLY" != true ]; then
  echo "DRY_RUN_OK=true"
  exit 0
fi

install -d -m 0755 "$CACHE_ROOT/1" "$RUNTIME_DIR"
recovered=0
while IFS='|' read -r media_id drive_path source expected_sha; do
  [ -n "$drive_path" ] || continue
  case "$drive_path" in
    /media/1/*) ;;
    *) continue ;;
  esac
  rel="${drive_path#/media/}"
  target="$CACHE_ROOT/$rel"
  if [ -f "$target" ]; then
    echo "RECOVERY_SKIP_EXISTING=$drive_path"
    continue
  fi
  install -d -m 0755 "$(dirname "$target")"
  cp --reflink=auto --preserve=timestamps "$source" "$target"
  chmod 0644 "$target"
  if [ -n "$expected_sha" ]; then
    actual="$(sha256sum "$target" | awk '{print $1}')"
    [ "$actual" = "$expected_sha" ] || {
      rm -f "$target"
      echo "BLOCKED: checksum mismatch after copy for $drive_path" >&2
      exit 82
    }
  fi
  recovered=$((recovered + 1))
  echo "RECOVERY_COPIED=$drive_path"
done < "$plan_file"

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
cp "$missing_file" "$RUNTIME_DIR/media-recovery-unresolved-${stamp}.tsv"
{
  echo "created_at_utc=$(date -u +%FT%TZ)"
  echo "catalog_total=$((planned_count + missing_count))"
  echo "deterministic_matches=$planned_count"
  echo "recovered_now=$recovered"
  echo "unresolved=$missing_count"
} > "$RUNTIME_DIR/media-recovery-${stamp}.txt"
ln -sfn "media-recovery-${stamp}.txt" "$RUNTIME_DIR/media-recovery-latest.txt"
ln -sfn "media-recovery-unresolved-${stamp}.tsv" "$RUNTIME_DIR/media-recovery-unresolved-latest.tsv"

echo "RECOVERY_APPLIED=true"
echo "RECOVERY_COPIED_COUNT=$recovered"
echo "RECOVERY_UNRESOLVED_COUNT=$missing_count"
