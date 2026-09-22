#!/usr/bin/env bash
set -euo pipefail
BASE=/opt/gsa-tv
BACKUP_ROOT="$BASE/backups/full"
KEY_FILE="/home/opc/.gsa_tv_secret_key"
ENV_FILE="$BASE/control-plane/.env"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$BACKUP_ROOT/$STAMP"
TMP="$BACKUP_ROOT/.${STAMP}.tmp"
mkdir -p "$BACKUP_ROOT" "$TMP" "$OUT"
chmod 0750 "$BACKUP_ROOT" "$OUT"
DB_URL="$(awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}' "$ENV_FILE")"
if [[ -z "$DB_URL" || ! -s "$KEY_FILE" ]]; then echo "backup prerequisites missing" >&2; exit 2; fi
RUN_ID="$(psql "$DB_URL" -X -Atq -c "insert into public.gsa_tv_backup_runs(channel_id,backup_type,state,details) values('ch-main','full','running','{}') returning id")"
cleanup(){ rm -rf "$TMP"; }
on_error(){ code=$?; set +e; [[ "${RESTORE_CREATED:-0}" == "1" && -n "${RESTORE_DB:-}" ]] && psql "$DB_URL" -X -c "drop database if exists \"$RESTORE_DB\" with (force)" >/dev/null 2>&1; psql "$DB_URL" -X -c "update public.gsa_tv_backup_runs set state='failed',details=jsonb_build_object('exit_code',$code),finished_at=now() where id='$RUN_ID'" >/dev/null 2>&1; exit "$code"; }
trap cleanup EXIT
trap on_error ERR
pg_dump "$DB_URL" --format=custom --compress=6 --no-owner --no-acl -f "$TMP/database-full.dump"
pg_dump "$DB_URL" --format=custom --compress=6 --no-owner --no-acl --table='public.gsa_tv_*' -f "$TMP/database-gsa-tv.dump"
FFPLAYOUT_DB="$BASE/config/ffplayout/ffplayout.db"
if [[ ! -s "$FFPLAYOUT_DB" ]]; then
  echo "ffplayout database missing on host bind: $FFPLAYOUT_DB" >&2
  exit 5
fi
python3 - "$FFPLAYOUT_DB" "$TMP/ffplayout.db" <<'PY'
import sqlite3
import sys

source_path, destination_path = sys.argv[1], sys.argv[2]
source = sqlite3.connect(f"file:{source_path}?mode=ro", uri=True, timeout=30)
destination = sqlite3.connect(destination_path, timeout=30)
try:
    source.backup(destination)
    row = destination.execute("pragma integrity_check").fetchone()
    if not row or row[0] != "ok":
        raise SystemExit(f"SQLite integrity_check failed: {row!r}")
finally:
    destination.close()
    source.close()
PY

archive_paths=()
for rel in cache/media playlists fallback config/ffplayout; do
  [[ -e "$BASE/$rel" ]] && archive_paths+=("$rel")
done
if [[ "${#archive_paths[@]}" -gt 0 ]]; then
  tar -C "$BASE" -czf "$TMP/media-and-playout.tgz" "${archive_paths[@]}"
else
  tar -C "$BASE" -czf "$TMP/media-and-playout.tgz" --files-from /dev/null
fi

: > "$TMP/media.sha256"
if [[ -d "$BASE/cache/media" ]]; then
  find "$BASE/cache/media" -type f -print0 | sort -z | xargs -0 -r sha256sum > "$TMP/media.sha256"
fi

CATALOG_TOTAL="$(psql "$DB_URL" -X -Atq -c "select count(*) from public.gsa_tv_media_items")"
CATALOG_WITH_PATH="$(psql "$DB_URL" -X -Atq -c "select count(*) from public.gsa_tv_media_items where nullif(drive_path,'') is not null")"
CATALOG_MISSING=0
: > "$TMP/media-catalog-missing.txt"
while IFS='|' read -r media_id drive_path; do
  [[ -n "$drive_path" ]] || continue
  case "$drive_path" in
    /media/*)
      host_path="$BASE/cache$drive_path"
      if [[ ! -f "$host_path" ]]; then
        printf '%s|%s\n' "$media_id" "$drive_path" >> "$TMP/media-catalog-missing.txt"
        CATALOG_MISSING=$((CATALOG_MISSING + 1))
      fi
      ;;
  esac
done < <(psql "$DB_URL" -X -Atq -F '|' -c "select id,drive_path from public.gsa_tv_media_items where nullif(drive_path,'') is not null order by id")

{
  echo "backup_version=2"
  echo "created_at_utc=$(date -u +%FT%TZ)"
  echo "cache_media_present=$([[ -d "$BASE/cache/media" ]] && echo true || echo false)"
  echo "catalog_total=$CATALOG_TOTAL"
  echo "catalog_with_path=$CATALOG_WITH_PATH"
  echo "catalog_missing_files=$CATALOG_MISSING"
  echo "archived_paths=${archive_paths[*]:-none}"
} > "$TMP/media-inventory.txt"
runtime_paths=()
for rel in control-plane watchdog; do
  [[ -e "$BASE/$rel" ]] && runtime_paths+=("$rel")
done
if [[ "${#runtime_paths[@]}" -gt 0 ]]; then
  tar -C "$BASE" --exclude='control-plane/.env' --exclude='watchdog/.env' --exclude='*/secrets/*' -czf "$TMP/runtime-config.tgz" "${runtime_paths[@]}"
else
  tar -C "$BASE" -czf "$TMP/runtime-config.tgz" --files-from /dev/null
fi

SECRET_TAR="$TMP/secrets.tar"
secret_paths=()
for rel in control-plane/.env watchdog/.env secrets control-plane/secrets watchdog/secrets; do
  [[ -e "$BASE/$rel" ]] && secret_paths+=("$rel")
done
if [[ "${#secret_paths[@]}" -gt 0 ]]; then
  tar -C "$BASE" -cf "$SECRET_TAR" "${secret_paths[@]}"
else
  tar -C "$BASE" -cf "$SECRET_TAR" --files-from /dev/null
fi
openssl enc -aes-256-cbc -salt -pbkdf2 -iter 200000 -pass file:"$KEY_FILE" -in "$SECRET_TAR" -out "$TMP/secrets.tar.enc"
rm -f "$SECRET_TAR"
cp "$BASE/playlists/1/$(date +%F).json" "$TMP/current-playlist.json" 2>/dev/null || true
( cd "$TMP" && sha256sum database-full.dump database-gsa-tv.dump ffplayout.db media-and-playout.tgz media.sha256 media-inventory.txt media-catalog-missing.txt runtime-config.tgz secrets.tar.enc > manifest.sha256 )
pg_restore --list "$TMP/database-full.dump" >/dev/null
sqlite_tmp="$TMP/ffplayout-restore-test.db"
cp "$TMP/ffplayout.db" "$sqlite_tmp"
python3 - "$sqlite_tmp" <<'PY'
import sqlite3
import sys

db = sqlite3.connect(f"file:{sys.argv[1]}?mode=ro", uri=True, timeout=30)
try:
    row = db.execute("pragma integrity_check").fetchone()
    if not row or row[0] != "ok":
        raise SystemExit(f"SQLite restore integrity_check failed: {row!r}")
finally:
    db.close()
PY
RESTORE_DB="gsa_tv_restore_${STAMP//[^a-zA-Z0-9]/_}"
RESTORE_URL="${DB_URL%/*}/$RESTORE_DB"
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -c "create database \"$RESTORE_DB\"" >/dev/null
RESTORE_CREATED=1
pg_restore --dbname="$RESTORE_URL" --no-owner --no-acl --exit-on-error "$TMP/database-full.dump"
TABLES="$(psql "$RESTORE_URL" -X -Atc "select count(*) from pg_tables where schemaname='public' and tablename like 'gsa_tv_%'")"
if [[ "$TABLES" -lt 20 ]]; then echo "restore test returned only $TABLES GSA TV tables" >&2; exit 3; fi
SOURCE_MEDIA="$(psql "$DB_URL" -X -Atc "select count(*) from public.gsa_tv_media_items")"
RESTORED_MEDIA="$(psql "$RESTORE_URL" -X -Atc "select count(*) from public.gsa_tv_media_items")"
SOURCE_JOBS="$(psql "$DB_URL" -X -Atc "select count(*) from public.gsa_tv_jobs")"
RESTORED_JOBS="$(psql "$RESTORE_URL" -X -Atc "select count(*) from public.gsa_tv_jobs")"
if [[ "$SOURCE_MEDIA" != "$RESTORED_MEDIA" || "$SOURCE_JOBS" != "$RESTORED_JOBS" ]]; then echo "restore row count mismatch" >&2; exit 4; fi
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -c "drop database \"$RESTORE_DB\" with (force)" >/dev/null
RESTORE_CREATED=0
mv "$TMP"/* "$OUT"/
SIZE="$(du -sb "$OUT" | awk '{print $1}')"
ROOT_SHA="$(sha256sum "$OUT/manifest.sha256" | awk '{print $1}')"
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -c "update public.gsa_tv_backup_runs set state='restored_test',archive_path='$OUT',sha256='$ROOT_SHA',size_bytes=$SIZE,details=jsonb_build_object('restore_tables',$TABLES,'sqlite_integrity','ok','media_rows',$RESTORED_MEDIA,'job_rows',$RESTORED_JOBS,'restore_scope','full_database_plus_runtime','catalog_total',$CATALOG_TOTAL,'catalog_with_path',$CATALOG_WITH_PATH,'catalog_missing_files',$CATALOG_MISSING),finished_at=now() where id='$RUN_ID'" >/dev/null
find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime +30 -exec rm -rf {} +
echo "$OUT"
