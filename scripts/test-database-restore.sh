#!/usr/bin/env bash
set -euo pipefail

backup_file="${1:-}"
if [[ -z "$backup_file" || ! -f "$backup_file" ]]; then
  echo 'Uso: scripts/test-database-restore.sh caminho/para/database.dump' >&2
  exit 1
fi

for command_name in createdb dropdb pg_restore psql sha256sum; do
  command -v "$command_name" >/dev/null 2>&1 || {
    echo "$command_name não está instalado." >&2
    exit 1
  }
done

restore_database="gsa_restore_test_$(date -u +%Y%m%d%H%M%S)_$RANDOM"
cleanup() {
  dropdb --if-exists "$restore_database" >/dev/null 2>&1 || true
}
trap cleanup EXIT

createdb "$restore_database"

restore_schemas="${RESTORE_TEST_SCHEMAS:-public,supabase_migrations}"
IFS=',' read -r -a schema_names <<< "$restore_schemas"
restore_args=()
for schema_name in "${schema_names[@]}"; do
  schema_name="${schema_name//[[:space:]]/}"
  [[ -n "$schema_name" ]] || continue
  [[ "$schema_name" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]] || {
    echo "Schema inválido em RESTORE_TEST_SCHEMAS: $schema_name" >&2
    exit 1
  }
  restore_args+=(--schema="$schema_name")
done

if [[ "${#restore_args[@]}" -eq 0 ]]; then
  echo 'RESTORE_TEST_SCHEMAS não contém schemas válidos.' >&2
  exit 1
fi

pg_restore \
  --exit-on-error \
  --no-owner \
  --no-acl \
  "${restore_args[@]}" \
  --dbname="$restore_database" \
  "$backup_file"

psql --dbname="$restore_database" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE
  v_tables integer;
  v_functions integer;
BEGIN
  SELECT count(*) INTO v_tables
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

  SELECT count(*) INTO v_functions
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public';

  IF v_tables = 0 THEN
    RAISE EXCEPTION 'Restauração não contém tabelas públicas';
  END IF;

  IF v_functions = 0 THEN
    RAISE EXCEPTION 'Restauração não contém funções públicas';
  END IF;

  IF to_regclass('supabase_migrations.schema_migrations') IS NULL THEN
    RAISE EXCEPTION 'Histórico de migrations ausente na restauração';
  END IF;
END $$;

SELECT 'DATABASE_RESTORE_TEST_OK' AS result;
SQL

printf 'DATABASE_RESTORE_TEST_OK=%s\n' "$restore_database"
