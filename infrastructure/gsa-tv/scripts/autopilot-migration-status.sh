#!/usr/bin/env bash
# Read-only status for the five canonical Autopilot V2 migrations.
set -euo pipefail

BASE="${GSA_TV_BASE:-/opt/gsa-tv}"
ENV_FILE="${GSA_TV_ENV_FILE:-$BASE/control-plane/.env}"

command -v psql >/dev/null
[ -f "$ENV_FILE" ] || { echo "BLOCKED: env file missing" >&2; exit 78; }
DB_URL="$(awk -F= '$1=="DATABASE_URL"{sub(/^[^=]*=/,"");print;exit}' "$ENV_FILE")"
[ -n "$DB_URL" ] || { echo "BLOCKED: DATABASE_URL missing" >&2; exit 78; }

history_table="$(psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -c "select case when to_regclass('supabase_migrations.schema_migrations') is null then 'missing' else 'present' end")"
echo "MIGRATION_HISTORY_TABLE=$history_table"

if [ "$history_table" = "present" ]; then
  row="$(psql "$DB_URL" -X -qAt -F '|' -v ON_ERROR_STOP=1 <<'SQL'
with checks(version, history_ok, contract_ok) as (
  values
    (
      '20260922131000',
      exists(select 1 from supabase_migrations.schema_migrations where version='20260922131000'),
      to_regprocedure('public.gsa_tv_guard_automation_compile()') is not null
    ),
    (
      '20260922132000',
      exists(select 1 from supabase_migrations.schema_migrations where version='20260922132000'),
      to_regprocedure('public.gsa_tv_autopilot_replace_shortfall_media(uuid,text,text,date)') is not null
    ),
    (
      '20260922134000',
      exists(select 1 from supabase_migrations.schema_migrations where version='20260922134000'),
      to_regprocedure('public.gsa_tv_autopilot_assign_continuity_fallback(uuid,text,text,date)') is not null
    ),
    (
      '20260922135000',
      exists(select 1 from supabase_migrations.schema_migrations where version='20260922135000'),
      to_regprocedure('public.gsa_tv_guard_cinema_duration_compile()') is not null
    ),
    (
      '20260922136000',
      exists(select 1 from supabase_migrations.schema_migrations where version='20260922136000'),
      to_regprocedure('public.gsa_tv_production_signature(uuid)') is not null
      and position(
        'resolved_media_id'
        in coalesce(pg_get_functiondef('public.gsa_tv_production_signature(uuid)'::regprocedure),'')
      ) > 0
    )
)
select version,history_ok,contract_ok from checks order by version;
SQL
)"
else
  row="$(psql "$DB_URL" -X -qAt -F '|' -v ON_ERROR_STOP=1 <<'SQL'
with checks(version, history_ok, contract_ok) as (
  values
    ('20260922131000', false, to_regprocedure('public.gsa_tv_guard_automation_compile()') is not null),
    ('20260922132000', false, to_regprocedure('public.gsa_tv_autopilot_replace_shortfall_media(uuid,text,text,date)') is not null),
    ('20260922134000', false, to_regprocedure('public.gsa_tv_autopilot_assign_continuity_fallback(uuid,text,text,date)') is not null),
    ('20260922135000', false, to_regprocedure('public.gsa_tv_guard_cinema_duration_compile()') is not null),
    (
      '20260922136000',
      false,
      to_regprocedure('public.gsa_tv_production_signature(uuid)') is not null
      and position(
        'resolved_media_id'
        in coalesce(pg_get_functiondef('public.gsa_tv_production_signature(uuid)'::regprocedure),'')
      ) > 0
    )
)
select version,history_ok,contract_ok from checks order by version;
SQL
)"
fi

all_ready=true
inconsistent=false
while IFS='|' read -r version history_ok contract_ok; do
  [ -n "$version" ] || continue
  [ "$history_ok" = t ] || all_ready=false
  [ "$contract_ok" = t ] || all_ready=false
  if { [ "$history_ok" = t ] && [ "$contract_ok" != t ]; }; then
    inconsistent=true
  fi
  echo "MIGRATION_STATUS=$version|history=$history_ok|contract=$contract_ok"
done <<<"$row"

if [ "$inconsistent" = true ]; then
  echo "MIGRATION_STATE=inconsistent"
  exit 2
fi
if [ "$all_ready" = true ]; then
  echo "MIGRATION_STATE=ready"
else
  echo "MIGRATION_STATE=pending"
fi
