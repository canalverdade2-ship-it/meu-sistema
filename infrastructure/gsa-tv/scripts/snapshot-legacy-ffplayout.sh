#!/usr/bin/env bash
# Snapshot the currently running legacy ffplayout container without restarting it.
# Dry-run by default. --apply writes only under /opt/gsa-tv/backups and /tmp inside
# the ffplayout container; it never stops/restarts services or changes source data.
set -euo pipefail

APPLY=false
VERIFY_LATEST=false
CONTAINER="${GSA_TV_FFPLAYOUT_CONTAINER:-gsa-tv-ffplayout}"
ROOT="${GSA_TV_LEGACY_SNAPSHOT_ROOT:-/opt/gsa-tv/backups/legacy-ffplayout-snapshot}"
RESERVE_BYTES="${GSA_TV_LEGACY_SNAPSHOT_RESERVE_BYTES:-1073741824}"

usage() {
  cat <<'EOF'
Usage:
  snapshot-legacy-ffplayout.sh
  snapshot-legacy-ffplayout.sh --apply
  snapshot-legacy-ffplayout.sh --verify-latest

Default mode is read-only dry-run.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --apply) APPLY=true ;;
    --verify-latest) VERIFY_LATEST=true ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 64 ;;
  esac
  shift
done

command -v docker >/dev/null
command -v sha256sum >/dev/null

container_running="$(docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null || true)"
[ "$container_running" = "true" ] || {
  echo "BLOCKED: $CONTAINER is not running." >&2
  exit 75
}

health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$CONTAINER" 2>/dev/null || true)"
image="$(docker inspect -f '{{.Config.Image}}' "$CONTAINER" 2>/dev/null || true)"
container_id="$(docker inspect -f '{{.Id}}' "$CONTAINER" 2>/dev/null || true)"
started_at="$(docker inspect -f '{{.State.StartedAt}}' "$CONTAINER" 2>/dev/null || true)"

verify_dir() {
  local dir="$1"
  [ -d "$dir" ] || { echo "VERIFY_FAILED=missing_snapshot_dir"; return 1; }
  [ -s "$dir/manifest.sha256" ] || { echo "VERIFY_FAILED=missing_manifest"; return 1; }
  (
    cd "$dir"
    sha256sum -c manifest.sha256 >/dev/null
  )
  [ -s "$dir/container/state/ffplayout.db" ] || {
    echo "VERIFY_FAILED=missing_ffplayout_db"
    return 1
  }
  echo "SNAPSHOT_VERIFY_OK=true"
  echo "SNAPSHOT_DIR=$dir"
}

if [ "$VERIFY_LATEST" = true ]; then
  latest="$(find "$ROOT" -mindepth 1 -maxdepth 1 -type d -name '20*' -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -1 | cut -d' ' -f2- || true)"
  [ -n "$latest" ] || { echo "BLOCKED: no legacy snapshot exists." >&2; exit 76; }
  verify_dir "$latest"
  exit 0
fi

paths=(state playlists public media logs)
estimated_bytes=0
echo "LEGACY_SNAPSHOT_PLAN_BEGIN"
echo "container=$CONTAINER"
echo "container_id=$container_id"
echo "image=$image"
echo "health=$health"
echo "started_at=$started_at"
for name in "${paths[@]}"; do
  if docker exec "$CONTAINER" sh -lc "test -e '/$name'" >/dev/null 2>&1; then
    bytes="$(docker exec "$CONTAINER" sh -lc "du -sb '/$name' 2>/dev/null | awk '{print \$1}'" 2>/dev/null || echo 0)"
    files="$(docker exec "$CONTAINER" sh -lc "find '/$name' -type f 2>/dev/null | wc -l" 2>/dev/null || echo 0)"
    bytes="${bytes:-0}"
    files="${files:-0}"
    [[ "$bytes" =~ ^[0-9]+$ ]] || bytes=0
    estimated_bytes=$((estimated_bytes + bytes))
    echo "source=/$name bytes=$bytes files=$files"
  else
    echo "source=/$name missing=true"
  fi
done

free_bytes="$(df -PB1 /opt/gsa-tv/backups 2>/dev/null | awk 'NR==2{print $4}')"
free_bytes="${free_bytes:-0}"
required_bytes=$((estimated_bytes + RESERVE_BYTES))
echo "estimated_source_bytes=$estimated_bytes"
echo "reserve_bytes=$RESERVE_BYTES"
echo "required_free_bytes=$required_bytes"
echo "available_free_bytes=$free_bytes"
echo "target_root=$ROOT"
echo "LEGACY_SNAPSHOT_PLAN_END"

if [ "$APPLY" != true ]; then
  echo "DRY_RUN_OK=true"
  exit 0
fi

[[ "$free_bytes" =~ ^[0-9]+$ ]] || { echo "BLOCKED: cannot determine free space." >&2; exit 77; }
[ "$free_bytes" -gt "$required_bytes" ] || {
  echo "BLOCKED: insufficient free space for legacy snapshot." >&2
  exit 78
}

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
tmp="$ROOT/.${stamp}.tmp"
out="$ROOT/$stamp"
state_host="$(docker inspect "$CONTAINER" --format '{{range .Mounts}}{{if eq .Destination "/state"}}{{.Source}}{{end}}{{end}}' 2>/dev/null || true)"
[ -n "$state_host" ] && [ -d "$state_host" ] || {
  echo "BLOCKED: ffplayout /state bind mount is unavailable." >&2
  exit 80
}
container_tmp="/state/.gsa-tv-legacy-snapshot-${stamp}.db"
host_tmp="$state_host/.gsa-tv-legacy-snapshot-${stamp}.db"

cleanup() {
  docker exec "$CONTAINER" rm -f "$container_tmp" >/dev/null 2>&1 || true
  rm -f "$host_tmp" >/dev/null 2>&1 || true
  if [ -n "${tmp:-}" ] && [ -d "$tmp" ]; then rm -rf "$tmp"; fi
}
trap cleanup EXIT

install -d -m 0750 "$ROOT"
[ ! -e "$tmp" ] && [ ! -e "$out" ] || { echo "BLOCKED: snapshot path collision." >&2; exit 79; }
install -d -m 0700 "$tmp/container"

{
  echo "snapshot_version=1"
  echo "created_at_utc=$(date -u +%FT%TZ)"
  echo "container=$CONTAINER"
  echo "container_id=$container_id"
  echo "image=$image"
  echo "health=$health"
  echo "started_at=$started_at"
  echo "mounts_begin"
  docker inspect "$CONTAINER" --format '{{range .Mounts}}{{println .Type "|" .Source "|" .Destination "|" .Mode "|" .RW}}{{end}}' 2>/dev/null || true
  echo "mounts_end"
} > "$tmp/runtime.txt"

for name in "${paths[@]}"; do
  install -d -m 0700 "$tmp/container/$name"
  if docker exec "$CONTAINER" sh -lc "test -e '/$name'" >/dev/null 2>&1; then
    docker cp "$CONTAINER:/$name/." "$tmp/container/$name/"
  fi
done

# Replace any live-copied SQLite file with a transactionally consistent SQLite backup.
# Materialize beside the live DB on the already-writable /state bind mount, then
# remove the temporary file after copying it into the immutable snapshot.
docker exec -u 0 "$CONTAINER" sqlite3 /state/ffplayout.db ".backup '$container_tmp'"
[ -s "$host_tmp" ] || {
  echo "BLOCKED: SQLite backup was not materialized on the /state bind mount." >&2
  exit 81
}
docker exec -u 0 "$CONTAINER" sqlite3 -readonly "$container_tmp" "pragma integrity_check;" | grep -qx ok
rm -f "$tmp/container/state/ffplayout.db"
cp -a "$host_tmp" "$tmp/container/state/ffplayout.db"
[ -s "$tmp/container/state/ffplayout.db" ]

{
  echo "destination_inventory_begin"
  for name in "${paths[@]}"; do
    bytes="$(du -sb "$tmp/container/$name" 2>/dev/null | awk '{print $1}')"
    files="$(find "$tmp/container/$name" -type f 2>/dev/null | wc -l)"
    echo "destination=/$name bytes=${bytes:-0} files=${files:-0}"
  done
  echo "destination_inventory_end"
} >> "$tmp/runtime.txt"

(
  cd "$tmp"
  find . -type f ! -name manifest.sha256 -print0     | sort -z     | xargs -0 sha256sum > manifest.sha256
  sha256sum -c manifest.sha256 >/dev/null
)

chmod -R o-rwx "$tmp"
mv "$tmp" "$out"
tmp=""
trap - EXIT
docker exec "$CONTAINER" rm -f "$container_tmp" >/dev/null 2>&1 || true
rm -f "$host_tmp" >/dev/null 2>&1 || true

verify_dir "$out"
echo "SNAPSHOT_APPLIED=true"
