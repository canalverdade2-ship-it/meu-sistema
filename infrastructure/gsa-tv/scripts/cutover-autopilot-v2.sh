#!/usr/bin/env bash
# GSA TV Autopilot V2 — controlled legacy automation cutover.
#
# Default mode is dry-run. It never stops an active legacy service process.
# It only disables legacy timers after the corresponding Autopilot replacement
# is installed, enabled and explicitly authorized.
set -euo pipefail

APPLY=false
SCOPE="all"
for arg in "$@"; do
  case "$arg" in
    --apply) APPLY=true ;;
    --scope=broadcast) SCOPE="broadcast" ;;
    --scope=production) SCOPE="production" ;;
    --scope=all) SCOPE="all" ;;
    -h|--help)
      sed -n '1,22p' "$0"
      exit 0
      ;;
    *)
      echo "Argumento desconhecido: $arg" >&2
      exit 64
      ;;
  esac
done

ROOT="${GSA_TV_ROOT:-/opt/gsa-tv}"
POLICY_FILE="$ROOT/autopilot/autopilot.env"
STATE_DIR="$ROOT/runtime/autopilot"
BACKUP_ROOT="$ROOT/backups/autopilot-v2-cutover"

BROADCAST_LEGACY_TIMERS=(gsa-tv-morning-start.timer gsa-tv-signoff.timer)
BROADCAST_LEGACY_SERVICES=(gsa-tv-morning-start.service gsa-tv-signoff.service)
PRODUCTION_LEGACY_TIMERS=(gsa-tv-night-factory.timer)
PRODUCTION_LEGACY_SERVICES=(gsa-tv-night-factory.service)

read_policy() {
  local key="$1"
  [ -f "$POLICY_FILE" ] || return 0
  awk -F= -v k="$key" '
    $1 == k {
      sub(/^[^=]*=/, "")
      gsub(/^[[:space:]]+|[[:space:]]+$/, "")
      gsub(/^["'"'"']|["'"'"']$/, "")
      print
      exit
    }
  ' "$POLICY_FILE"
}

truthy() {
  case "$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')" in
    1|true|yes|on) return 0 ;;
    *) return 1 ;;
  esac
}

unit_active() { systemctl is-active --quiet "$1"; }
timer_enabled() { systemctl is-enabled --quiet "$1" 2>/dev/null; }
timer_exists() { systemctl cat "$1" >/dev/null 2>&1; }

assert_container_running() {
  local name="$1"
  [ "$(docker inspect -f '{{.State.Running}}' "$name" 2>/dev/null || true)" = "true" ] || {
    echo "BLOCKED: container obrigatório não está running: $name" >&2
    exit 75
  }
}

assert_http_health() {
  curl -fsS --max-time 4 "$1" >/dev/null || {
    echo "BLOCKED: health check falhou: $1" >&2
    exit 75
  }
}

assert_no_active_legacy_services() {
  local unit
  for unit in "$@"; do
    if unit_active "$unit"; then
      echo "BLOCKED: serviço legado está ativo e não será interrompido automaticamente: $unit" >&2
      exit 76
    fi
  done
}

assert_timer_active() {
  unit_active "$1" || {
    echo "BLOCKED: timer substituto não está ativo: $1" >&2
    exit 77
  }
}

assert_recent_readiness() {
  local file="$STATE_DIR/readiness-horizon.json"
  [ -s "$file" ] || {
    echo "BLOCKED: readiness snapshot ausente: $file" >&2
    exit 78
  }
  python3 - "$file" <<'PY'
import datetime as dt
import json
import sys
from zoneinfo import ZoneInfo

path = sys.argv[1]
tz = ZoneInfo("America/Sao_Paulo")
data = json.load(open(path, encoding="utf-8"))
raw = str(data.get("generated_at") or "").replace("Z", "+00:00")
try:
    generated = dt.datetime.fromisoformat(raw)
    if generated.tzinfo is None:
        generated = generated.replace(tzinfo=tz)
except Exception as exc:
    raise SystemExit(f"BLOCKED: generated_at inválido no readiness: {exc}")
age = (dt.datetime.now(tz).astimezone(dt.timezone.utc) - generated.astimezone(dt.timezone.utc)).total_seconds()
if age < 0 or age > 1800:
    raise SystemExit(f"BLOCKED: readiness antigo: age_s={age:.0f}")

tomorrow = (dt.datetime.now(tz).date() + dt.timedelta(days=1)).isoformat()
day = next((x for x in data.get("days_detail", []) if x.get("date") == tomorrow), None)
if not day:
    raise SystemExit("BLOCKED: D+1 ausente no readiness")
if day.get("schedule_state") != "published":
    raise SystemExit(f"BLOCKED: D+1 não published: {day.get('schedule_state')}")
if float(day.get("coverage_pct") or 0) < 100.0:
    raise SystemExit(f"BLOCKED: D+1 coverage <100%: {day.get('coverage_pct')}")
if float(day.get("content_coverage_pct") or 0) < 99.0:
    raise SystemExit(f"BLOCKED: D+1 content coverage <99%: {day.get('content_coverage_pct')}")
if int(day.get("hard_issue_count") or 0) != 0:
    raise SystemExit(f"BLOCKED: D+1 tem hard issues: {day.get('hard_issue_count')}")
print("D1_READY=true")
PY
}

assert_container_running gsa-tv-control-plane
assert_container_running gsa-tv-ffplayout
assert_container_running gsa-tv-encoder-engine
assert_http_health http://127.0.0.1:9202/health
assert_http_health http://127.0.0.1:9210/health

broadcast_selected=false
production_selected=false
if [ "$SCOPE" = "all" ] || [ "$SCOPE" = "broadcast" ]; then broadcast_selected=true; fi
if [ "$SCOPE" = "all" ] || [ "$SCOPE" = "production" ]; then production_selected=true; fi

[ -f "$POLICY_FILE" ] || {
  echo "BLOCKED: policy file ausente: $POLICY_FILE" >&2
  exit 79
}

if [ "$broadcast_selected" = true ]; then
  assert_timer_active gsa-tv-autopilot-broadcast-controller.timer
  assert_no_active_legacy_services "${BROADCAST_LEGACY_SERVICES[@]}"
fi

if [ "$production_selected" = true ]; then
  truthy "$(read_policy GSA_TV_AUTOPILOT_AUTO_APPROVE)" || {
    echo "Falha de pós-condição: production policy não foi ativada." >&2
    exit 80
  }
  assert_timer_active gsa-tv-autopilot-content-factory.timer
  assert_timer_active gsa-tv-autopilot-readiness.timer
  assert_no_active_legacy_services "${PRODUCTION_LEGACY_SERVICES[@]}"
  assert_recent_readiness
fi

echo "GSA TV Autopilot V2 cutover plan"
echo "scope=$SCOPE"
echo "apply=$APPLY"
echo "broadcast_selected=$broadcast_selected"
echo "production_selected=$production_selected"
echo "broadcast_policy_current=$(read_policy GSA_TV_BROADCAST_AUTOMATION_ENABLED)"
echo "production_policy_current=$(read_policy GSA_TV_AUTOPILOT_AUTO_APPROVE)"

for unit in "${BROADCAST_LEGACY_TIMERS[@]}" "${PRODUCTION_LEGACY_TIMERS[@]}"; do
  if timer_exists "$unit"; then
    if timer_enabled "$unit"; then
      echo "legacy_timer=$unit enabled=true"
    else
      echo "legacy_timer=$unit enabled=false"
    fi
  fi
done

if [ "$APPLY" != true ]; then
  echo "CUTOVER_DRY_RUN_OK=true"
  exit 0
fi

install -d -m 0700 "$BACKUP_ROOT"
BACKUP_DIR="$BACKUP_ROOT/$(date -u +%Y%m%dT%H%M%SZ)"
install -d -m 0700 "$BACKUP_DIR"
cp -a "$POLICY_FILE" "$BACKUP_DIR/autopilot.env"
chmod 600 "$BACKUP_DIR/autopilot.env"

record_unit_state() {
  local unit="$1"
  if timer_exists "$unit"; then
    if timer_enabled "$unit"; then
      printf '%s|enabled\n' "$unit" >> "$BACKUP_DIR/legacy-timers.state"
    else
      printf '%s|disabled\n' "$unit" >> "$BACKUP_DIR/legacy-timers.state"
    fi
  fi
}

rollback() {
  local rc=$?
  set +e
  if [ -f "$BACKUP_DIR/autopilot.env" ]; then
    cp -f "$BACKUP_DIR/autopilot.env" "$POLICY_FILE" || true
    chmod 600 "$POLICY_FILE" || true
  fi
  if [ -s "$BACKUP_DIR/legacy-timers.state" ]; then
    while IFS='|' read -r unit state; do
      if [ "$state" = "enabled" ]; then
        systemctl enable --now "$unit" >/dev/null 2>&1 || true
      else
        systemctl disable "$unit" >/dev/null 2>&1 || true
      fi
    done < "$BACKUP_DIR/legacy-timers.state"
  fi
  echo "CUTOVER_ROLLBACK=true backup=$BACKUP_DIR" >&2
  exit "$rc"
}
trap rollback ERR

if [ "$broadcast_selected" = true ]; then
  for unit in "${BROADCAST_LEGACY_TIMERS[@]}"; do
    record_unit_state "$unit"
    timer_exists "$unit" && systemctl disable --now "$unit"
  done
fi

if [ "$production_selected" = true ]; then
  for unit in "${PRODUCTION_LEGACY_TIMERS[@]}"; do
    record_unit_state "$unit"
    timer_exists "$unit" && systemctl disable --now "$unit"
  done
fi

python3 - "$POLICY_FILE" "$broadcast_selected" "$production_selected" <<'PY'
import os
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
broadcast = sys.argv[2] == "true"
production = sys.argv[3] == "true"
desired = {}
if broadcast:
    desired["GSA_TV_BROADCAST_AUTOMATION_ENABLED"] = "true"
if production:
    desired["GSA_TV_AUTOPILOT_AUTO_APPROVE"] = "true"

lines = path.read_text(encoding="utf-8").splitlines()
seen = set()
out = []
for line in lines:
    stripped = line.strip()
    key = stripped.split("=", 1)[0] if "=" in stripped and not stripped.startswith("#") else None
    if key in desired:
        out.append(f"{key}={desired[key]}")
        seen.add(key)
    else:
        out.append(line)
for key, value in desired.items():
    if key not in seen:
        out.append(f"{key}={value}")

tmp = path.with_suffix(path.suffix + ".tmp")
tmp.write_text("\n".join(out) + "\n", encoding="utf-8")
os.chmod(tmp, 0o600)
os.replace(tmp, path)
PY

systemctl daemon-reload

if [ "$broadcast_selected" = true ]; then
  truthy "$(read_policy GSA_TV_BROADCAST_AUTOMATION_ENABLED)" || {
    echo "Falha de pós-condição: broadcast policy não foi ativada." >&2
    exit 80
  }
  assert_timer_active gsa-tv-autopilot-broadcast-controller.timer
  for unit in "${BROADCAST_LEGACY_TIMERS[@]}"; do
    if timer_exists "$unit" && timer_enabled "$unit"; then
      echo "Falha de pós-condição: timer legado ainda enabled: $unit" >&2
      exit 80
    fi
  done
fi

if [ "$production_selected" = true ]; then
  assert_timer_active gsa-tv-autopilot-content-factory.timer
  assert_timer_active gsa-tv-autopilot-readiness.timer
  for unit in "${PRODUCTION_LEGACY_TIMERS[@]}"; do
    if timer_exists "$unit" && timer_enabled "$unit"; then
      echo "Falha de pós-condição: timer legado ainda enabled: $unit" >&2
      exit 80
    fi
  done
fi

trap - ERR
echo "CUTOVER_OK=true"
echo "CUTOVER_BACKUP=$BACKUP_DIR"
