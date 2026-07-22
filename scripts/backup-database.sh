#!/usr/bin/env bash
set -euo pipefail

: "${SUPABASE_DB_URL:?SUPABASE_DB_URL deve estar configurada em um secret seguro.}"

output_root="${1:-backups}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_dir="${output_root%/}/database-${timestamp}"
mkdir -p "$backup_dir"
umask 077

command -v pg_dump >/dev/null 2>&1 || {
  echo 'pg_dump não está instalado.' >&2
  exit 1
}
command -v sha256sum >/dev/null 2>&1 || {
  echo 'sha256sum não está instalado.' >&2
  exit 1
}

custom_file="$backup_dir/database.dump"
schema_file="$backup_dir/schema.sql"
manifest_file="$backup_dir/manifest.json"

pg_dump "$SUPABASE_DB_URL" \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-acl \
  --file="$custom_file"

pg_dump "$SUPABASE_DB_URL" \
  --schema-only \
  --no-owner \
  --no-acl \
  --file="$schema_file"

custom_sha="$(sha256sum "$custom_file" | awk '{print $1}')"
schema_sha="$(sha256sum "$schema_file" | awk '{print $1}')"
custom_size="$(wc -c < "$custom_file" | tr -d ' ')"
schema_size="$(wc -c < "$schema_file" | tr -d ' ')"

cat > "$manifest_file" <<JSON
{
  "created_at_utc": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "format": "postgresql-custom",
  "database_file": "database.dump",
  "database_sha256": "$custom_sha",
  "database_bytes": $custom_size,
  "schema_file": "schema.sql",
  "schema_sha256": "$schema_sha",
  "schema_bytes": $schema_size
}
JSON

printf 'DATABASE_BACKUP_OK=%s\n' "$backup_dir"
