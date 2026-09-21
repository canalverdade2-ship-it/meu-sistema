#!/usr/bin/env bash
# GSA TV — aplica migrations SQL em ordem crescente
# Uso: migrate.sh [--dry-run] [--target 003]
# Requer: PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD (ou .pgpass)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="${SCRIPT_DIR}/migrations"
DRY_RUN=false
TARGET_VERSION=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run) DRY_RUN=true; shift ;;
    --target)  TARGET_VERSION="$2"; shift 2 ;;
    *) echo >&2 "Opção desconhecida: $1"; exit 2 ;;
  esac
done

# Garantir tabela de controle de migrations
psql --no-psqlrc -v ON_ERROR_STOP=1 <<'SQL'
CREATE SCHEMA IF NOT EXISTS gsa_tv;
CREATE TABLE IF NOT EXISTS gsa_tv.schema_migrations (
  version     TEXT PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  filename    TEXT NOT NULL
);
SQL

APPLIED=0
SKIPPED=0
ERRORS=0

for MIGRATION in $(ls "${MIGRATIONS_DIR}"/*.sql | sort); do
  FILENAME=$(basename "$MIGRATION")
  VERSION=$(echo "$FILENAME" | grep -oP '^\d+')

  # Parar no target se especificado
  if [[ -n "$TARGET_VERSION" && "$VERSION" > "$TARGET_VERSION" ]]; then
    echo "[migrate] Parado no target $TARGET_VERSION"
    break
  fi

  # Verificar se já foi aplicada
  ALREADY=$(psql --no-psqlrc -t -c "SELECT COUNT(*) FROM gsa_tv.schema_migrations WHERE version = '${VERSION}'" 2>/dev/null | tr -d ' ')
  if [[ "$ALREADY" == "1" ]]; then
    echo "[migrate] Pulando $FILENAME (já aplicada)"
    ((SKIPPED++))
    continue
  fi

  if $DRY_RUN; then
    echo "[migrate] DRY-RUN: aplicaria $FILENAME"
    ((APPLIED++))
    continue
  fi

  echo "[migrate] Aplicando $FILENAME..."
  if psql --no-psqlrc -v ON_ERROR_STOP=1 -f "$MIGRATION"; then
    psql --no-psqlrc -v ON_ERROR_STOP=1 \
      -c "INSERT INTO gsa_tv.schema_migrations (version, filename) VALUES ('${VERSION}', '${FILENAME}') ON CONFLICT DO NOTHING"
    echo "[migrate] OK: $FILENAME"
    ((APPLIED++))
  else
    echo >&2 "[migrate] ERRO em $FILENAME"
    ((ERRORS++))
  fi
done

echo ""
echo "[migrate] Resultado: ${APPLIED} aplicadas, ${SKIPPED} puladas, ${ERRORS} erros"
[[ "$ERRORS" -eq 0 ]]
