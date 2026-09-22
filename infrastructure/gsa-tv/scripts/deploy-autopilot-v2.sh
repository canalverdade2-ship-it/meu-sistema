#!/usr/bin/env bash
# GSA TV Autopilot V2 — deterministic runtime installer.
#
# Default: dry-run / validation only.
# Apply:   sudo ./deploy-autopilot-v2.sh --apply
#
# The first migration from a coupled Control Plane to the independent encoder
# is intentionally OFF-AIR only. Once runtime 1.8.0 + encoder-engine is active,
# future Control Plane replacements can preserve the encoder process.
set -euo pipefail

APPLY=false
ENABLE_TIMERS=true
for arg in "$@"; do
  case "$arg" in
    --apply) APPLY=true ;;
    --no-enable-timers) ENABLE_TIMERS=false ;;
    -h|--help)
      sed -n '1,18p' "$0"
      exit 0
      ;;
    *)
      echo "Argumento desconhecido: $arg" >&2
      exit 64
      ;;
  esac
done

if [ "$(id -u)" -ne 0 ]; then
  echo "Execute como root/sudo." >&2
  exit 77
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
INFRA="$REPO_ROOT/infrastructure/gsa-tv"
CONTROL_SRC="$INFRA/services/playout-api"
ENCODER_SRC="$INFRA/services/encoder-engine"
SYSTEMD_SRC="$INFRA/systemd"
ENV_FILE="/opt/gsa-tv/control-plane/.env"
CONTROL_DIR="/opt/gsa-tv/control-plane"
ENCODER_DIR="/opt/gsa-tv/encoder-engine"
BIN_DIR="/opt/gsa-tv/bin"
RUNTIME_DIR="/opt/gsa-tv/runtime"
TOOLS_DIR="/opt/gsa-tv/cache/media/1/production/autonomous/tools"
CONTROL_IMAGE="gsa-tv/control-plane:1.8.0"
ENCODER_IMAGE="gsa-tv/encoder-engine:1.0.0"
BACKUP_ROOT="/opt/gsa-tv/backups/autopilot-v2"
BACKUP_DIR=""
MUTATION_STARTED=false
ENCODER_MUTATED=false

rollback_runtime() {
  local rc=$?
  if [ "$MUTATION_STARTED" != true ] || [ -z "$BACKUP_DIR" ]; then
    exit "$rc"
  fi

  echo "Deploy falhou (rc=$rc). Iniciando rollback local..." >&2
  set +e

  systemctl disable --now gsa-tv-autopilot-content-factory.timer >/dev/null 2>&1 || true
  systemctl disable --now gsa-tv-autopilot-readiness.timer >/dev/null 2>&1 || true
  systemctl disable --now gsa-tv-autopilot-broadcast-controller.timer >/dev/null 2>&1 || true

  for unit in     gsa-tv-autopilot-readiness.service     gsa-tv-autopilot-readiness.timer     gsa-tv-autopilot-content-factory.service     gsa-tv-autopilot-content-factory.timer     gsa-tv-autopilot-broadcast-controller.service     gsa-tv-autopilot-broadcast-controller.timer; do
    if [ -f "$BACKUP_DIR/systemd/$unit" ]; then
      cp -f "$BACKUP_DIR/systemd/$unit" "/etc/systemd/system/$unit"
    elif [ -f "/etc/systemd/system/$unit" ]; then
      rm -f "/etc/systemd/system/$unit"
    fi
  done
  systemctl daemon-reload >/dev/null 2>&1 || true

  if [ -f "$BACKUP_DIR/control-plane.env" ]; then
    cp -f "$BACKUP_DIR/control-plane.env" "$ENV_FILE"
    chmod 600 "$ENV_FILE"
  fi

  if [ -s "$BACKUP_DIR/control-plane-target-image-id.txt" ]; then
    old_control_image_id="$(cat "$BACKUP_DIR/control-plane-target-image-id.txt")"
    [ "$old_control_image_id" = "missing" ] || docker tag "$old_control_image_id" "$CONTROL_IMAGE" >/dev/null 2>&1 || true
  fi
  if [ -s "$BACKUP_DIR/encoder-target-image-id.txt" ]; then
    old_encoder_image_id="$(cat "$BACKUP_DIR/encoder-target-image-id.txt")"
    [ "$old_encoder_image_id" = "missing" ] || docker tag "$old_encoder_image_id" "$ENCODER_IMAGE" >/dev/null 2>&1 || true
  fi

  if [ -f "$BACKUP_DIR/control-plane-compose.yml" ]; then
    cp -f "$BACKUP_DIR/control-plane-compose.yml" "$CONTROL_DIR/compose.yml"
    docker compose --project-directory "$CONTROL_DIR" -f "$CONTROL_DIR/compose.yml" up -d --force-recreate >/dev/null 2>&1 || true
  fi

  if [ "$ENCODER_MUTATED" = true ]; then
    if [ -f "$BACKUP_DIR/encoder-compose.yml" ]; then
      cp -f "$BACKUP_DIR/encoder-compose.yml" "$ENCODER_DIR/compose.yml"
      docker compose --project-directory "$ENCODER_DIR" -f "$ENCODER_DIR/compose.yml" up -d --force-recreate >/dev/null 2>&1 || true
    elif [ "$(cat "$BACKUP_DIR/encoder-existed" 2>/dev/null)" != "true" ]; then
      docker rm -f gsa-tv-encoder-engine >/dev/null 2>&1 || true
    fi
  fi

  echo "Rollback local concluído. Backup: $BACKUP_DIR" >&2
  exit "$rc"
}

required_repo_files=(
  "$CONTROL_SRC/Dockerfile"
  "$CONTROL_SRC/src/app.js"
  "$CONTROL_SRC/compose.production.yml"
  "$ENCODER_SRC/Dockerfile"
  "$ENCODER_SRC/src/app.js"
  "$ENCODER_SRC/compose.production.yml"
  "$INFRA/scripts/autopilot-runtime-preflight.sh"
  "$INFRA/scripts/cutover-autopilot-v2.sh"
  "$INFRA/scripts/autopilot-readiness.py"
  "$INFRA/scripts/autopilot-content-factory.py"
  "$INFRA/scripts/autopilot-broadcast-controller.py"
  "$INFRA/scripts/autopilot-duration-engine.py"
  "$INFRA/scripts/autopilot-fallback-engine.py"
  "$INFRA/scripts/night-production.py"
  "$INFRA/scripts/daily-scripts.py"
  "$INFRA/scripts/autonomous-script.cjs"
  "$INFRA/scripts/render-generic-program.py"
  "$SYSTEMD_SRC/gsa-tv-autopilot-readiness.service"
  "$SYSTEMD_SRC/gsa-tv-autopilot-readiness.timer"
  "$SYSTEMD_SRC/gsa-tv-autopilot-content-factory.service"
  "$SYSTEMD_SRC/gsa-tv-autopilot-content-factory.timer"
  "$SYSTEMD_SRC/gsa-tv-autopilot-broadcast-controller.service"
  "$SYSTEMD_SRC/gsa-tv-autopilot-broadcast-controller.timer"
)
for f in "${required_repo_files[@]}"; do
  [ -f "$f" ] || { echo "Arquivo obrigatório ausente no checkout: $f" >&2; exit 66; }
done

command -v docker >/dev/null
command -v curl >/dev/null
docker compose version >/dev/null

[ -f "$ENV_FILE" ] || {
  echo "BLOCKED: $ENV_FILE não existe. Não é seguro reconstruir credenciais automaticamente." >&2
  exit 78
}
chmod 600 "$ENV_FILE"

read_env() {
  local key="$1"
  awk -F= -v key="$key" '$1==key{sub(/^[^=]*=/,"");print;exit}' "$ENV_FILE"
}

dburl="$(read_env DATABASE_URL)"
[ -n "$dburl" ] || { echo "BLOCKED: DATABASE_URL ausente no env protegido." >&2; exit 78; }

db_query() {
  local sql="$1"
  if command -v psql >/dev/null 2>&1; then
    PGPASSWORD="" psql "$dburl" -X -qAt -F '|' -v ON_ERROR_STOP=1 -c "$sql"
    return
  fi
  if docker inspect gsa-tv-control-plane >/dev/null 2>&1 &&
     [ "$(docker inspect -f '{{.State.Running}}' gsa-tv-control-plane 2>/dev/null || true)" = "true" ]; then
    docker exec -i gsa-tv-control-plane node -e '
      const { Pool } = require("pg");
      let sql = "";
      process.stdin.on("data", c => sql += c);
      process.stdin.on("end", async () => {
        const p = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
        try {
          const r = await p.query(sql);
          for (const row of r.rows || []) {
            process.stdout.write(Object.values(row).map(v => v == null ? "" : String(v)).join("|") + "\n");
          }
        } finally {
          await p.end().catch(() => {});
        }
      });
    ' <<<"$sql"
    return
  fi
  echo "BLOCKED: validação DB read-only exige psql no host ou Control Plane em execução; nenhum container auxiliar será criado." >&2
  return 78
}

state="$(db_query "select coalesce(desired_state,'unknown'),coalesce(signal_state,'unknown'),coalesce(playout_state,'unknown') from public.gsa_tv_channels where id='ch-main'" 2>/dev/null || true)"
IFS='|' read -r desired signal playout <<<"$state"
desired="${desired:-unknown}"
signal="${signal:-unknown}"
playout="${playout:-unknown}"

cp_image="$(docker inspect gsa-tv-control-plane -f '{{.Config.Image}}' 2>/dev/null || true)"
enc_image="$(docker inspect gsa-tv-encoder-engine -f '{{.Config.Image}}' 2>/dev/null || true)"
encoder_running="$(docker inspect gsa-tv-encoder-engine -f '{{.State.Running}}' 2>/dev/null || true)"
cp_external=false
if docker inspect gsa-tv-control-plane >/dev/null 2>&1; then
  docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}'     | grep -q '^ENCODER_ENGINE_URL=http://127\.0\.0\.1:9210$' && cp_external=true || true
fi

runtime_off_air=false
if [ "$desired" = "stopped" ] && [ "$signal" = "stopped" ] && [ "$playout" = "off_air" ]; then
  runtime_off_air=true
fi

migrated=false
if [ "$cp_image" = "$CONTROL_IMAGE" ] &&
   [ "$enc_image" = "$ENCODER_IMAGE" ] &&
   [ "$cp_external" = true ] &&
   [ "$encoder_running" = "true" ]; then
  if curl -fsS --max-time 4 http://127.0.0.1:9210/health >/dev/null 2>&1; then
    migrated=true
  fi
fi

if [ "$migrated" != true ]; then
  if [ "$desired" != "stopped" ] || [ "$signal" != "stopped" ] || [ "$playout" != "off_air" ]; then
    cat >&2 <<EOF
BLOCKED: primeira migração para Encoder Engine independente exige estado off-air explícito.
desired_state=$desired
signal_state=$signal
playout_state=$playout
control_plane_image=${cp_image:-missing}

Estado exigido para primeira migração:
desired_state=stopped
signal_state=stopped
playout_state=off_air

O instalador é fail-closed e não desliga uma transmissão pública automaticamente.
EOF
    exit 75
  fi
fi

# DB contract must already be applied through the canonical Supabase migration path.
db_contract="$(db_query "select
  to_regprocedure('public.gsa_tv_autopilot_replace_shortfall_media(uuid,text,text,date)') is not null,
  position('v_date > v_today + 7' in pg_get_functiondef('public.gsa_tv_guard_automation_compile()'::regprocedure)) > 0,
  to_regprocedure('public.gsa_tv_autopilot_assign_continuity_fallback(uuid,text,text,date)') is not null,
  to_regprocedure('public.gsa_tv_guard_cinema_duration_compile()') is not null,
  position('resolved_media_id' in pg_get_functiondef('public.gsa_tv_production_signature(uuid)'::regprocedure)) > 0
" 2>/dev/null || true)"
if [ "$db_contract" != "t|t|t|t|t" ]; then
  cat >&2 <<'EOF'
BLOCKED: migrations do Autopilot ainda não estão aplicadas no banco.

Aplique pelo fluxo canônico de migrations do projeto:
- 20260922131000_gsa_tv_autopilot_compile_gate.sql
- 20260922132000_gsa_tv_autopilot_duration_swap.sql
- 20260922134000_gsa_tv_autopilot_continuity_fallback.sql
- 20260922135000_gsa_tv_cinema_duration_contract.sql
- 20260922136000_gsa_tv_resolved_production_signature.sql

O instalador não executa SQL fora do histórico de migrations.
EOF
  exit 79
fi

backup_row="$(db_query "select state, greatest(0,extract(epoch from now()-coalesce(finished_at,started_at)))::bigint, coalesce(archive_path,'') from public.gsa_tv_backup_runs where channel_id='ch-main' order by coalesce(finished_at,started_at) desc limit 1" 2>/dev/null || true)"
IFS='|' read -r backup_state backup_age_s backup_archive <<<"$backup_row"
backup_state="${backup_state:-unknown}"
backup_age_s="${backup_age_s:-999999999}"
backup_archive="${backup_archive:-}"
backup_max_age_s="${GSA_TV_DEPLOY_BACKUP_MAX_AGE_S:-172800}"

backup_manifest_ok=false
if [ -n "$backup_archive" ] &&
   [ -s "$backup_archive/manifest.sha256" ] &&
   (cd "$backup_archive" && sha256sum -c manifest.sha256 >/dev/null 2>&1); then
  backup_manifest_ok=true
fi

if [ "$backup_state" != "restored_test" ] ||
   ! [[ "$backup_age_s" =~ ^[0-9]+$ ]] ||
   [ "$backup_age_s" -gt "$backup_max_age_s" ] ||
   [ "$backup_manifest_ok" != true ]; then
  cat >&2 <<EOF
BLOCKED: deploy exige backup full restaurado/testado e íntegro.
backup_state=$backup_state
backup_age_s=$backup_age_s
backup_max_age_s=$backup_max_age_s
backup_archive=${backup_archive:-missing}
backup_manifest_ok=$backup_manifest_ok

Execute/verifique gsa-tv-backup.service antes do rollout.
EOF
  exit 84
fi

token="$(read_env ENCODER_ENGINE_TOKEN)"
if [ -z "$token" ] || [ "${#token}" -lt 32 ]; then
  if [ "$APPLY" != true ]; then
    echo "WOULD_GENERATE=ENCODER_ENGINE_TOKEN"
  else
    command -v openssl >/dev/null
    token="$(openssl rand -hex 32)"
    printf '\nENCODER_ENGINE_TOKEN=%s\n' "$token" >> "$ENV_FILE"
    chmod 600 "$ENV_FILE"
  fi
fi
unset token

cat <<EOF
GSA TV Autopilot V2 deployment plan
------------------------------------
apply=$APPLY
already_external_migrated=$migrated
desired_state=$desired
signal_state=$signal
playout_state=$playout
control_plane_current=${cp_image:-missing}
control_plane_target=$CONTROL_IMAGE
encoder_current=${enc_image:-missing}
encoder_target=$ENCODER_IMAGE
runtime_off_air=$runtime_off_air
backup_state=$backup_state
backup_age_s=$backup_age_s
backup_manifest_ok=$backup_manifest_ok
enable_timers=$ENABLE_TIMERS
EOF

if [ "$APPLY" != true ]; then
  echo "DRY_RUN_OK=true"
  exit 0
fi

# Rollback must be reconstructable before the first mutation.
if docker inspect gsa-tv-control-plane >/dev/null 2>&1 && [ ! -f "$CONTROL_DIR/compose.yml" ]; then
  echo "BLOCKED: Control Plane existente sem compose local para rollback seguro: $CONTROL_DIR/compose.yml" >&2
  exit 82
fi
if docker inspect gsa-tv-encoder-engine >/dev/null 2>&1 && [ ! -f "$ENCODER_DIR/compose.yml" ]; then
  echo "BLOCKED: Encoder Engine existente sem compose local para rollback seguro: $ENCODER_DIR/compose.yml" >&2
  exit 83
fi

install -d -m 0700 "$BACKUP_ROOT"
BACKUP_DIR="$BACKUP_ROOT/$(date -u +%Y%m%dT%H%M%SZ)"
install -d -m 0700 "$BACKUP_DIR/systemd"
cp -a "$ENV_FILE" "$BACKUP_DIR/control-plane.env"
chmod 600 "$BACKUP_DIR/control-plane.env"
[ -f "$CONTROL_DIR/compose.yml" ] && cp -a "$CONTROL_DIR/compose.yml" "$BACKUP_DIR/control-plane-compose.yml"
[ -f "$ENCODER_DIR/compose.yml" ] && cp -a "$ENCODER_DIR/compose.yml" "$BACKUP_DIR/encoder-compose.yml"
if docker inspect gsa-tv-encoder-engine >/dev/null 2>&1; then echo true > "$BACKUP_DIR/encoder-existed"; else echo false > "$BACKUP_DIR/encoder-existed"; fi
printf '%s\n' "${cp_image:-missing}" > "$BACKUP_DIR/control-plane-image.txt"
printf '%s\n' "${enc_image:-missing}" > "$BACKUP_DIR/encoder-image.txt"
printf '%s\n' "$(docker image inspect "$CONTROL_IMAGE" -f '{{.Id}}' 2>/dev/null || echo missing)" > "$BACKUP_DIR/control-plane-target-image-id.txt"
printf '%s\n' "$(docker image inspect "$ENCODER_IMAGE" -f '{{.Id}}' 2>/dev/null || echo missing)" > "$BACKUP_DIR/encoder-target-image-id.txt"
for unit in   gsa-tv-autopilot-readiness.service   gsa-tv-autopilot-readiness.timer   gsa-tv-autopilot-content-factory.service   gsa-tv-autopilot-content-factory.timer   gsa-tv-autopilot-broadcast-controller.service   gsa-tv-autopilot-broadcast-controller.timer; do
  [ -f "/etc/systemd/system/$unit" ] && cp -a "/etc/systemd/system/$unit" "$BACKUP_DIR/systemd/$unit"
done

trap rollback_runtime ERR
MUTATION_STARTED=true

install -d -m 0755 "$CONTROL_DIR" "$ENCODER_DIR" "$BIN_DIR" /opt/gsa-tv/releases
install -d -m 0750 /opt/gsa-tv/autopilot
if [ ! -f /opt/gsa-tv/autopilot/autopilot.env ]; then
  printf '%s\n' \
    'GSA_TV_AUTOPILOT_AUTO_APPROVE=false' \
    'GSA_TV_BROADCAST_AUTOMATION_ENABLED=false' \
    > /opt/gsa-tv/autopilot/autopilot.env
  chmod 0600 /opt/gsa-tv/autopilot/autopilot.env
fi
install -d -m 2770 -o 989 -g 989 "$RUNTIME_DIR" "$RUNTIME_DIR/autopilot"
install -d -m 2775 -o 989 -g 989 "$TOOLS_DIR"

release="/opt/gsa-tv/releases/autopilot-v2-$(date -u +%Y%m%dT%H%M%SZ)"
install -d -m 0755 "$release/control-plane/src" "$release/encoder-engine/src"

cp "$CONTROL_SRC/Dockerfile" "$CONTROL_SRC/package.json" "$release/control-plane/"
cp "$CONTROL_SRC/src/"*.js "$release/control-plane/src/"
cp "$ENCODER_SRC/Dockerfile" "$ENCODER_SRC/package.json" "$release/encoder-engine/"
cp "$ENCODER_SRC/src/"*.js "$release/encoder-engine/src/"

docker build --pull -t "$ENCODER_IMAGE" "$release/encoder-engine"
docker build --pull -t "$CONTROL_IMAGE" "$release/control-plane"

# Install runtime compose definitions without touching .env or secret files.
install -m 0644 "$ENCODER_SRC/compose.production.yml" "$ENCODER_DIR/compose.yml"
install -m 0644 "$CONTROL_SRC/compose.production.yml" "$CONTROL_DIR/compose.yml"

# Start/refresh the independent encoder first only while explicitly off-air.
# On an already-migrated live runtime the encoder transport is continuity-critical:
# do not recreate it as part of a Control Plane rollout.
if [ "$runtime_off_air" = true ]; then
  ENCODER_MUTATED=true
  docker compose --project-directory "$ENCODER_DIR" -f "$ENCODER_DIR/compose.yml" up -d --force-recreate
else
  echo "ENCODER_RECREATE_SKIPPED=runtime_not_off_air"
fi
deadline=$((SECONDS + 60))
until curl -fsS --max-time 3 http://127.0.0.1:9210/health >/dev/null 2>&1; do
  [ "$SECONDS" -lt "$deadline" ] || {
    docker logs --tail 80 gsa-tv-encoder-engine >&2 || true
    echo "Encoder Engine não ficou healthy." >&2
    exit 80
  }
  sleep 2
done

# Replace the Control Plane. The initial migration is off-air by policy.
# Once 1.8.0/external is already active, SIGTERM preserves encoder + ffplayout.
docker compose --project-directory "$CONTROL_DIR" -f "$CONTROL_DIR/compose.yml" up -d --force-recreate --no-deps control-plane
deadline=$((SECONDS + 90))
until curl -fsS --max-time 3 http://127.0.0.1:9202/health >/dev/null 2>&1; do
  [ "$SECONDS" -lt "$deadline" ] || {
    docker logs --tail 120 gsa-tv-control-plane >&2 || true
    echo "Control Plane não ficou healthy." >&2
    exit 81
  }
  sleep 2
done

# Contract markers: do not trust image tags alone.
docker exec gsa-tv-control-plane node -e '
const fs=require("fs");
const s=fs.readFileSync("/app/src/app.js","utf8");
if(!s.includes("control_plane_shutdown_encoder_preserved") || !s.includes("encoderEngineRequest")) process.exit(1);
'
docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}'   | grep -q '^ENCODER_ENGINE_URL=http://127\.0\.0\.1:9210$'

# Install Autopilot scripts.
for f in   autopilot-runtime-preflight.sh   cutover-autopilot-v2.sh   autopilot-readiness.py   autopilot-content-factory.py   autopilot-broadcast-controller.py   autopilot-duration-engine.py   autopilot-fallback-engine.py   night-production.py   daily-scripts.py; do
  install -m 0755 "$INFRA/scripts/$f" "$BIN_DIR/$f"
done

# The autonomous renderer is intentionally deployed into the mounted tool path
# used by the Control Plane container.
install -m 0644 -o 989 -g 989 "$INFRA/scripts/autonomous-script.cjs" "$TOOLS_DIR/autonomous-script.cjs"
install -m 0755 -o 989 -g 989 "$INFRA/scripts/render-generic-program.py" "$TOOLS_DIR/render-generic-program.py"
if [ -f "$INFRA/scripts/render-original-reflection.py" ]; then
  install -m 0755 -o 989 -g 989 "$INFRA/scripts/render-original-reflection.py" "$TOOLS_DIR/render-original-reflection.py"
fi

# Install timer units but do not remove legacy units in this migration.
for unit in   gsa-tv-autopilot-readiness.service   gsa-tv-autopilot-readiness.timer   gsa-tv-autopilot-content-factory.service   gsa-tv-autopilot-content-factory.timer   gsa-tv-autopilot-broadcast-controller.service   gsa-tv-autopilot-broadcast-controller.timer; do
  install -m 0644 "$SYSTEMD_SRC/$unit" "/etc/systemd/system/$unit"
done
systemctl daemon-reload

# Read-only smoke test first.
"$BIN_DIR/autopilot-readiness.py" --days 4 >/tmp/gsa-tv-autopilot-readiness-smoke.json

if [ "$ENABLE_TIMERS" = true ]; then
  systemctl enable --now gsa-tv-autopilot-readiness.timer
  systemctl enable --now gsa-tv-autopilot-content-factory.timer
  systemctl enable --now gsa-tv-autopilot-broadcast-controller.timer
fi

# Final invariant checks.
curl -fsS http://127.0.0.1:9202/health >/dev/null
curl -fsS http://127.0.0.1:9210/health >/dev/null
docker inspect gsa-tv-control-plane -f '{{.Config.Image}}' | grep -Fx "$CONTROL_IMAGE"
docker inspect gsa-tv-encoder-engine -f '{{.Config.Image}}' | grep -Fx "$ENCODER_IMAGE"

if [ "$desired" = "running" ] || [ "$signal" = "sending" ]; then
  # Only reachable for an already-migrated runtime update.
  engine_state="$(curl -fsS -H "Authorization: Bearer $(read_env ENCODER_ENGINE_TOKEN)" http://127.0.0.1:9210/v1/status)"
  printf '%s' "$engine_state" | grep -q '"outer_running":true'
  printf '%s' "$engine_state" | grep -q '"producer_running":true'
fi

MUTATION_STARTED=false
trap - ERR
echo "DEPLOY_OK=true"
echo "RELEASE_DIR=$release"
echo "ROLLBACK_BACKUP=$BACKUP_DIR"
