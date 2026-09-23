#!/usr/bin/env bash
# Strict one-time reconciliation helper for the two collision migrations
# evidenced by Migration Collision Read-only Audit run 35804719264.
set -euo pipefail

BASE="${GSA_TV_BASE:-/opt/gsa-tv}"
ENV_FILE="${GSA_TV_ENV_FILE:-$BASE/control-plane/.env}"
VERSION=""
NAME=""
FILE=""
MODE="status"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --version) VERSION="${2:-}"; shift 2 ;;
    --name) NAME="${2:-}"; shift 2 ;;
    --file) FILE="${2:-}"; shift 2 ;;
    --mode) MODE="${2:-}"; shift 2 ;;
    -h|--help)
      echo "Usage: apply-reconciliation-migration.sh --version VERSION --name NAME --mode status|apply [--file SQL]"
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
  20260923013000:reconcile_partner_redemption_collision) ;;
  20260923013100:reconcile_checkout_shipping_collision) ;;
  *) echo "BLOCKED: non-canonical reconciliation migration identity" >&2; exit 79 ;;
esac

if [ "$MODE" = apply ]; then
  [ -n "$FILE" ] && [ -f "$FILE" ] || {
    echo "BLOCKED: canonical SQL file missing" >&2
    exit 80
  }
elif [ "$MODE" != status ]; then
  echo "BLOCKED: mode must be status or apply" >&2
  exit 64
fi

history_present() {
  if [ "$(psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -c "select case when to_regclass('supabase_migrations.schema_migrations') is null then 'f' else 't' end")" != t ]; then
    echo f
    return
  fi
  psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -c     "select case when exists(select 1 from supabase_migrations.schema_migrations where version='$VERSION') then 't' else 'f' end"
}

contract_ok() {
  case "$VERSION" in
    20260923013000)
      psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 <<'SQL'
select case when
  to_regprocedure('public.gsa_admin_cancel_partner_redemption(uuid,text,uuid,text)') is not null
  and to_regprocedure('public.gsa_admin_delete_partner_redemption(uuid,text,uuid,text)') is not null
  and to_regprocedure('public.gsa_bot_find_partner_redemption(uuid,text,text)') is not null
  and exists(select 1 from information_schema.columns where table_schema='public' and table_name='parceiros_resgates' and column_name='motivo_cancelamento')
  and exists(select 1 from information_schema.columns where table_schema='public' and table_name='parceiros_resgates' and column_name='cancelado_por')
  and position('EXCLUIR_RESGATE' in coalesce(pg_get_functiondef(to_regprocedure('public.gsa_admin_delete_partner_redemption(uuid,text,uuid,text)')),'')) > 0
  and position('r.status <> ''recusado''' in coalesce(pg_get_functiondef(to_regprocedure('public.gsa_bot_find_partner_redemption(uuid,text,text)')),'')) > 0
then 't' else 'f' end;
SQL
      ;;
    20260923013100)
      psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 <<'SQL'
select case when
  to_regprocedure('public.gsa_client_claim_invoice_generation(uuid,text,uuid)') is not null
  and to_regprocedure('public.gsa_client_sync_pix_invoice(uuid,text,uuid,text,text,jsonb)') is not null
  and to_regprocedure('public.gsa_admin_ship_store_order(uuid,text,uuid,uuid,text,boolean,text)') is not null
  and exists(select 1 from information_schema.columns where table_schema='public' and table_name='ordens_compra' and column_name='entrega_rastreavel')
  and exists(select 1 from information_schema.columns where table_schema='public' and table_name='ordens_compra' and column_name='codigo_rastreio')
  and exists(select 1 from information_schema.columns where table_schema='public' and table_name='orcamentos' and column_name='entrega_rastreavel')
  and exists(select 1 from information_schema.columns where table_schema='public' and table_name='orcamentos' and column_name='codigo_rastreio')
  and position('pendente_geracao' in coalesce(pg_get_functiondef(to_regprocedure('public.gsa_client_claim_invoice_generation(uuid,text,uuid)')),'')) > 0
  and position('pedido_rastreio_disponivel' in coalesce(pg_get_functiondef(to_regprocedure('public.gsa_admin_ship_store_order(uuid,text,uuid,uuid,text,boolean,text)')),'')) > 0
then 't' else 'f' end;
SQL
      ;;
  esac
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
  psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 <<SQL
INSERT INTO supabase_migrations.schema_migrations(version,name,statements)
VALUES ('$VERSION', '$NAME', NULL)
ON CONFLICT (version) DO UPDATE SET name=EXCLUDED.name;
SQL
}

before_history="$(history_present)"
before_contract="$(contract_ok)"
echo "RECONCILIATION_VERSION=$VERSION"
echo "RECONCILIATION_BEFORE_HISTORY=$before_history"
echo "RECONCILIATION_BEFORE_CONTRACT=$before_contract"

if [ "$MODE" = status ]; then
  [ "$before_history" != t ] || [ "$before_contract" = t ] || exit 81
  exit 0
fi

if [ "$before_history" = t ]; then
  [ "$before_contract" = t ] || {
    echo "BLOCKED: history exists without verified reconciliation contract" >&2
    exit 81
  }
  echo "RECONCILIATION_ALREADY_READY=true"
  exit 0
fi

if [ "$before_contract" != t ]; then
  psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f "$FILE"
  [ "$(contract_ok)" = t ] || {
    echo "BLOCKED: migration SQL completed without required contract" >&2
    exit 84
  }
  echo "RECONCILIATION_SQL_APPLIED=true"
else
  echo "RECONCILIATION_HISTORY_REPAIR=true"
fi

provision_history
record_history

after_history="$(history_present)"
after_contract="$(contract_ok)"
[ "$after_history" = t ] && [ "$after_contract" = t ] || {
  echo "BLOCKED: reconciliation did not verify history+contract" >&2
  exit 85
}

echo "RECONCILIATION_READY=true"
echo "RECONCILIATION_AFTER_HISTORY=$after_history"
echo "RECONCILIATION_AFTER_CONTRACT=$after_contract"
