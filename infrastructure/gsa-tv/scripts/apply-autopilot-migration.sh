#!/usr/bin/env bash
# Apply or repair one canonical GSA TV Autopilot migration against the
# self-hosted PostgreSQL database configured on the production VPS.
#
# This script never uses Supabase Cloud/Management API. It reads DATABASE_URL
# only from the VPS runtime env file, validates the expected contract, and
# records the migration in the standard supabase_migrations ledger.
set -euo pipefail

BASE="${GSA_TV_BASE:-/opt/gsa-tv}"
ENV_FILE="${GSA_TV_ENV_FILE:-$BASE/control-plane/.env}"
VERSION=""
NAME=""
MODE=""
FILE=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --version) VERSION="${2:-}"; shift 2 ;;
    --name) NAME="${2:-}"; shift 2 ;;
    --mode) MODE="${2:-}"; shift 2 ;;
    --file) FILE="${2:-}"; shift 2 ;;
    -h|--help)
      echo "Usage: apply-autopilot-migration.sh --version VERSION --name NAME --mode apply|repair-history [--file SQL]"
      exit 0
      ;;
    *) echo "Unknown argument: $1" >&2; exit 64 ;;
  esac
done

command -v psql >/dev/null
[ -f "$ENV_FILE" ] || { echo "BLOCKED: env file missing" >&2; exit 78; }
DB_URL="$(awk -F= '$1=="DATABASE_URL"{sub(/^[^=]*=/,"");print;exit}' "$ENV_FILE")"
[ -n "$DB_URL" ] || { echo "BLOCKED: DATABASE_URL missing" >&2; exit 78; }

case "$VERSION:$NAME" in
  20260922131000:gsa_tv_autopilot_compile_gate) ;;
  20260922132000:gsa_tv_autopilot_duration_swap) ;;
  20260922134000:gsa_tv_autopilot_continuity_fallback) ;;
  20260922135000:gsa_tv_cinema_duration_contract) ;;
  20260922136000:gsa_tv_resolved_production_signature) ;;
  *) echo "BLOCKED: non-canonical migration identity" >&2; exit 79 ;;
esac

case "$MODE" in
  apply)
    [ -n "$FILE" ] && [ -f "$FILE" ] || {
      echo "BLOCKED: canonical SQL file missing for apply" >&2
      exit 80
    }
    ;;
  repair-history) ;;
  *) echo "BLOCKED: mode must be apply or repair-history" >&2; exit 64 ;;
esac

contract_ok() {
  case "$VERSION" in
    20260922131000)
      psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -c         "select case when to_regprocedure('public.gsa_tv_guard_automation_compile()') is not null then 't' else 'f' end"
      ;;
    20260922132000)
      psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -c         "select case when to_regprocedure('public.gsa_tv_autopilot_replace_shortfall_media(uuid,text,text,date)') is not null then 't' else 'f' end"
      ;;
    20260922134000)
      psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -c         "select case when to_regprocedure('public.gsa_tv_autopilot_assign_continuity_fallback(uuid,text,text,date)') is not null then 't' else 'f' end"
      ;;
    20260922135000)
      psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -c         "select case when to_regprocedure('public.gsa_tv_guard_cinema_duration_compile()') is not null then 't' else 'f' end"
      ;;
    20260922136000)
      psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -c         "select case when to_regprocedure('public.gsa_tv_production_signature(uuid)') is not null and position('resolved_media_id' in coalesce(pg_get_functiondef(to_regprocedure('public.gsa_tv_production_signature(uuid)')),'')) > 0 then 't' else 'f' end"
      ;;
  esac
}

history_present() {
  if [ "$(psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -c "select case when to_regclass('supabase_migrations.schema_migrations') is null then 'f' else 't' end")" != t ]; then
    echo f
    return
  fi
  psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -v version="$VERSION" -c     "select case when exists(select 1 from supabase_migrations.schema_migrations where version=:'version') then 't' else 'f' end"
}

provision_history() {
  psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
SET LOCAL lock_timeout='4s';
CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
  version text NOT NULL PRIMARY KEY
);
ALTER TABLE supabase_migrations.schema_migrations
  ADD COLUMN IF NOT EXISTS statements text[];
ALTER TABLE supabase_migrations.schema_migrations
  ADD COLUMN IF NOT EXISTS name text;
COMMIT;
SQL
}

record_history() {
  psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1     -v version="$VERSION" -v name="$NAME" <<'SQL'
INSERT INTO supabase_migrations.schema_migrations(version,name,statements)
VALUES (:'version', :'name', NULL)
ON CONFLICT (version) DO UPDATE
SET name=EXCLUDED.name;
SQL
}

before_contract="$(contract_ok)"
before_history="$(history_present)"
echo "MIGRATION_SELF_HOSTED_TARGET=true"
echo "MIGRATION_VERSION=$VERSION"
echo "MIGRATION_MODE=$MODE"
echo "MIGRATION_BEFORE_HISTORY=$before_history"
echo "MIGRATION_BEFORE_CONTRACT=$before_contract"

if [ "$before_history" = t ] && [ "$before_contract" != t ]; then
  echo "BLOCKED: migration history exists without required contract" >&2
  exit 81
fi

if [ "$MODE" = "repair-history" ]; then
  [ "$before_contract" = t ] || {
    echo "BLOCKED: refusing history repair without verified contract" >&2
    exit 82
  }
else
  if [ "$before_contract" = t ]; then
    echo "BLOCKED: contract already exists; use repair-history mode" >&2
    exit 83
  fi
  psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f "$FILE"
  [ "$(contract_ok)" = t ] || {
    echo "BLOCKED: migration SQL completed without required contract" >&2
    exit 84
  }
fi

provision_history
record_history

after_contract="$(contract_ok)"
after_history="$(history_present)"
[ "$after_contract" = t ] && [ "$after_history" = t ] || {
  echo "BLOCKED: migration did not verify history+contract" >&2
  exit 85
}

echo "MIGRATION_APPLIED_OR_REPAIRED=true"
echo "MIGRATION_AFTER_HISTORY=$after_history"
echo "MIGRATION_AFTER_CONTRACT=$after_contract"
