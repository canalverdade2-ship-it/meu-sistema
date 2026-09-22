#!/usr/bin/env bash
# GSA TV Autopilot V2 — runtime preflight (read-only)
set -euo pipefail

CHANNEL_ID="${GSA_TV_CHANNEL_ID:-ch-main}"
ENV_FILE="${GSA_TV_ENV_FILE:-/opt/gsa-tv/control-plane/.env}"

have() { command -v "$1" >/dev/null 2>&1; }
container_exists() { docker inspect "$1" >/dev/null 2>&1; }
container_running() { [ "$(docker inspect -f '{{.State.Running}}' "$1" 2>/dev/null || true)" = "true" ]; }
container_image() { docker inspect -f '{{.Config.Image}}' "$1" 2>/dev/null || printf 'missing'; }
container_health() {
  docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$1" 2>/dev/null || printf 'missing'
}
http_ok() { curl -fsS --max-time 4 "$1" >/dev/null 2>&1; }

if ! have docker || ! have curl; then
  echo "STATUS=BLOCKED"
  echo "REASON=missing_docker_or_curl"
  exit 20
fi

ffplayout="missing"
control="missing"
watchdog="missing"
encoder="missing"
container_running gsa-tv-ffplayout && ffplayout="$(container_health gsa-tv-ffplayout)"
container_running gsa-tv-control-plane && control="$(container_health gsa-tv-control-plane)"
container_running gsa-tv-watchdog && watchdog="$(container_health gsa-tv-watchdog)"
container_running gsa-tv-encoder-engine && encoder="$(container_health gsa-tv-encoder-engine)"

cp_image="$(container_image gsa-tv-control-plane)"
enc_image="$(container_image gsa-tv-encoder-engine)"

cp_external=false
if container_exists gsa-tv-control-plane; then
  if docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null       | grep -q '^ENCODER_ENGINE_URL=http://127\.0\.0\.1:9210$'; then
    cp_external=true
  fi
fi

cp_rtmp_ffmpeg=0
if container_running gsa-tv-control-plane; then
  cp_rtmp_ffmpeg="$(docker top gsa-tv-control-plane -eo args 2>/dev/null       | grep '[f]fmpeg' | grep -Eic '(^|[[:space:]])-f[[:space:]]+flv([[:space:]]|$)|rtmps?://' || true)"
fi

enc_ffmpeg=0
if container_running gsa-tv-encoder-engine; then
  enc_ffmpeg="$(docker top gsa-tv-encoder-engine -eo args 2>/dev/null       | grep -c '[f]fmpeg' || true)"
fi

control_http=false
encoder_http=false
watchdog_http=false
http_ok http://127.0.0.1:9202/health && control_http=true
http_ok http://127.0.0.1:9210/health && encoder_http=true
http_ok http://127.0.0.1:9204/health && watchdog_http=true

env_present=false
db_configured=false
encoder_token_configured=false
psql_available=false
database_url=""
if [ -f "$ENV_FILE" ]; then
  env_present=true
  grep -q '^DATABASE_URL=.' "$ENV_FILE" && db_configured=true || true
  database_url="$(awk -F= '$1=="DATABASE_URL"{sub(/^[^=]*=/,"");print;exit}' "$ENV_FILE" 2>/dev/null || true)"
  token_len="$(awk -F= '$1=="ENCODER_ENGINE_TOKEN"{sub(/^[^=]*=/,"");print length($0);exit}' "$ENV_FILE" 2>/dev/null || true)"
  if [ -n "$token_len" ] && [ "$token_len" -ge 32 ]; then encoder_token_configured=true; fi
fi
have psql && psql_available=true || true

desired_state="unknown"
signal_state="unknown"
playout_state="unknown"
if container_running gsa-tv-control-plane; then
  row="$(docker exec -e GSA_TV_PREFLIGHT_CHANNEL_ID="$CHANNEL_ID" gsa-tv-control-plane node -e '
    const { Pool } = require("pg");
    (async () => {
      const p = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
      try {
        const r = await p.query(
          "select coalesce(desired_state,$2) desired_state, coalesce(signal_state,$2) signal_state, coalesce(playout_state,$2) playout_state from public.gsa_tv_channels where id=$1 limit 1",
          [process.env.GSA_TV_PREFLIGHT_CHANNEL_ID, "unknown"]
        );
        if (r.rowCount) process.stdout.write(
          String(r.rows[0].desired_state) + "|" +
          String(r.rows[0].signal_state) + "|" +
          String(r.rows[0].playout_state)
        );
      } catch (_) {
        process.exitCode = 2;
      } finally {
        await p.end().catch(() => {});
      }
    })();
  ' 2>/dev/null || true)"
  if [ -n "$row" ]; then
    IFS='|' read -r desired_state signal_state playout_state <<<"$row"
    desired_state="${desired_state:-unknown}"
    signal_state="${signal_state:-unknown}"
    playout_state="${playout_state:-unknown}"
  fi
fi

if [ "$desired_state" = "unknown" ] && [ "$psql_available" = true ] && [ -n "$database_url" ]; then
  row="$(psql "$database_url" -X -qAt -F '|' -v ON_ERROR_STOP=1 -c "select coalesce(desired_state,'unknown'),coalesce(signal_state,'unknown'),coalesce(playout_state,'unknown') from public.gsa_tv_channels where id='${CHANNEL_ID}' limit 1" 2>/dev/null || true)"
  if [ -n "$row" ]; then
    IFS='|' read -r desired_state signal_state playout_state <<<"$row"
    desired_state="${desired_state:-unknown}"
    signal_state="${signal_state:-unknown}"
    playout_state="${playout_state:-unknown}"
  fi
fi

first_migration_offair_ready=false
if [ "$desired_state" = "stopped" ] &&
   [ "$signal_state" = "stopped" ] &&
   [ "$playout_state" = "off_air" ]; then
  first_migration_offair_ready=true
fi

latest_backup_state="unknown"
latest_backup_age_s="unknown"
latest_backup_archive=""
latest_backup_manifest_ok=false
if container_running gsa-tv-control-plane; then
  backup_row="$(docker exec gsa-tv-control-plane node -e '
    const { Pool } = require("pg");
    (async () => {
      const p = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
      try {
        const r = await p.query(
          "select state, greatest(0,extract(epoch from now()-coalesce(finished_at,started_at)))::bigint age_s, coalesce(archive_path,$1) archive_path from public.gsa_tv_backup_runs where channel_id=$2 order by coalesce(finished_at,started_at) desc limit 1",
          ["", process.env.CHANNEL_ID || "ch-main"]
        );
        if (r.rowCount) process.stdout.write(
          String(r.rows[0].state || "unknown") + "|" +
          String(r.rows[0].age_s || "unknown") + "|" +
          String(r.rows[0].archive_path || "")
        );
      } finally {
        await p.end().catch(() => {});
      }
    })().catch(() => process.exitCode = 2);
  ' 2>/dev/null || true)"
  if [ -n "$backup_row" ]; then
    IFS='|' read -r latest_backup_state latest_backup_age_s latest_backup_archive <<<"$backup_row"
    latest_backup_state="${latest_backup_state:-unknown}"
    latest_backup_age_s="${latest_backup_age_s:-unknown}"
    if [ -n "${latest_backup_archive:-}" ] &&
       [ -s "$latest_backup_archive/manifest.sha256" ] &&
       (cd "$latest_backup_archive" && sha256sum -c manifest.sha256 >/dev/null 2>&1); then
      latest_backup_manifest_ok=true
    fi
  fi
elif [ "$psql_available" = true ] && [ -n "$database_url" ]; then
  backup_row="$(psql "$database_url" -X -qAt -F '|' -v ON_ERROR_STOP=1 -c "select coalesce(state,'unknown'), greatest(0,extract(epoch from now()-coalesce(finished_at,started_at)))::bigint, coalesce(archive_path,'') from public.gsa_tv_backup_runs where channel_id='${CHANNEL_ID}' order by coalesce(finished_at,started_at) desc limit 1" 2>/dev/null || true)"
  if [ -n "$backup_row" ]; then
    IFS='|' read -r latest_backup_state latest_backup_age_s latest_backup_archive <<<"$backup_row"
    latest_backup_state="${latest_backup_state:-unknown}"
    latest_backup_age_s="${latest_backup_age_s:-unknown}"
    if [ -n "${latest_backup_archive:-}" ] &&
       [ -s "$latest_backup_archive/manifest.sha256" ] &&
       (cd "$latest_backup_archive" && sha256sum -c manifest.sha256 >/dev/null 2>&1); then
      latest_backup_manifest_ok=true
    fi
  fi
fi

legacy_broadcast_units=(
  gsa-tv-morning-start.timer
  gsa-tv-morning-start.service
  gsa-tv-signoff.timer
  gsa-tv-signoff.service
)
legacy_production_units=(
  gsa-tv-night-factory.timer
  gsa-tv-night-factory.service
)
active_legacy_broadcast=()
active_legacy_production=()
if have systemctl; then
  for unit in "${legacy_broadcast_units[@]}"; do
    if systemctl is-active --quiet "$unit" 2>/dev/null; then
      active_legacy_broadcast+=("$unit")
    fi
  done
  for unit in "${legacy_production_units[@]}"; do
    if systemctl is-active --quiet "$unit" 2>/dev/null; then
      active_legacy_production+=("$unit")
    fi
  done
fi

required_paths=(
  /opt/gsa-tv/cache/media/1
  /opt/gsa-tv/playlists/1
  /opt/gsa-tv/preview
  /opt/gsa-tv/fallback
  /opt/gsa-tv/runtime
)
missing_paths=()
for p in "${required_paths[@]}"; do
  [ -e "$p" ] || missing_paths+=("$p")
done

classification="PARTIAL"
exit_code=10

if [ "$control" = "missing" ]; then
  classification="CONTROL_PLANE_MISSING"
  exit_code=20
elif [ "$cp_external" = true ] && [ "$encoder_http" = true ]; then
  classification="EXTERNAL_READY"
  exit_code=0
elif [ "$cp_external" = false ] && [ "$encoder_http" = false ]; then
  classification="LEGACY_COUPLED"
  exit_code=10
else
  classification="PARTIAL_EXTERNAL"
  exit_code=20
fi

echo "STATUS=$classification"
echo "FFPLAYOUT_HEALTH=$ffplayout"
echo "CONTROL_PLANE_HEALTH=$control"
echo "CONTROL_PLANE_HTTP=$control_http"
echo "CONTROL_PLANE_IMAGE=$cp_image"
echo "WATCHDOG_HEALTH=$watchdog"
echo "WATCHDOG_HTTP=$watchdog_http"
echo "ENCODER_ENGINE_HEALTH=$encoder"
echo "ENCODER_ENGINE_HTTP=$encoder_http"
echo "ENCODER_ENGINE_IMAGE=$enc_image"
echo "CONTROL_PLANE_EXTERNAL_ENCODER=$cp_external"
echo "CONTROL_PLANE_RTMP_FFMPEG_COUNT=$cp_rtmp_ffmpeg"
echo "ENCODER_FFMPEG_COUNT=$enc_ffmpeg"
echo "DESIRED_STATE=$desired_state"
echo "SIGNAL_STATE=$signal_state"
echo "PLAYOUT_STATE=$playout_state"
echo "FIRST_MIGRATION_OFFAIR_READY=$first_migration_offair_ready"
echo "LATEST_BACKUP_STATE=$latest_backup_state"
echo "LATEST_BACKUP_AGE_S=$latest_backup_age_s"
echo "LATEST_BACKUP_ARCHIVE=${latest_backup_archive:-none}"
echo "LATEST_BACKUP_MANIFEST_OK=$latest_backup_manifest_ok"
echo "ENV_FILE_PRESENT=$env_present"
echo "DATABASE_CONFIGURED=$db_configured"
echo "PSQL_AVAILABLE=$psql_available"
echo "ENCODER_TOKEN_CONFIGURED=$encoder_token_configured"
echo "LEGACY_BROADCAST_AUTOMATION_ACTIVE=${active_legacy_broadcast[*]:-none}"
echo "LEGACY_PRODUCTION_AUTOMATION_ACTIVE=${active_legacy_production[*]:-none}"
echo "MISSING_PATHS=${missing_paths[*]:-none}"

if [ "${#missing_paths[@]}" -gt 0 ]; then
  echo "RUNTIME_PATH_DIAGNOSTICS_BEGIN"
  for p in     /opt/gsa-tv     /opt/gsa-tv/cache     /opt/gsa-tv/cache/media     /opt/gsa-tv/playlists     /opt/gsa-tv/preview     /opt/gsa-tv/fallback     /opt/gsa-tv/runtime; do
    if [ -e "$p" ]; then
      stat -c 'PATH=%n TYPE=%F OWNER=%u:%g MODE=%a' "$p" 2>/dev/null || true
    else
      echo "PATH=$p MISSING"
    fi
  done
  if container_exists gsa-tv-ffplayout; then
    echo "FFPLAYOUT_RUNTIME=$(docker inspect gsa-tv-ffplayout --format 'image={{.Config.Image}} network={{.HostConfig.NetworkMode}}' 2>/dev/null || true)"
    echo "FFPLAYOUT_MOUNTS_BEGIN"
    docker inspect gsa-tv-ffplayout --format '{{range .Mounts}}{{println .Source "->" .Destination}}{{end}}' 2>/dev/null || true
    echo "FFPLAYOUT_MOUNTS_END"
    echo "FFPLAYOUT_PATHS_BEGIN"
    docker exec gsa-tv-ffplayout sh -lc '
      for p in /state /playlists /media /public /logs /backups; do
        if [ -e "$p" ]; then
          stat -c "CONTAINER_PATH=%n TYPE=%F OWNER=%u:%g MODE=%a" "$p" 2>/dev/null || true
          du -sb "$p" 2>/dev/null | awk -v path="$p" "{print \"CONTAINER_BYTES=\" \$1 \" PATH=\" path}"
          find "$p" -type f 2>/dev/null | wc -l | awk -v path="$p" "{print \"CONTAINER_FILES=\" \$1 \" PATH=\" path}"
        else
          echo "CONTAINER_PATH=$p MISSING"
        fi
      done
    ' 2>/dev/null || true
    echo "FFPLAYOUT_PATHS_END"
  fi
  if have systemctl; then
    echo "BACKUP_SERVICE_STATE=$(systemctl show gsa-tv-backup.service -p ActiveState -p SubState -p Result -p ExecMainStatus --value 2>/dev/null | paste -sd ',' - || true)"
    echo "BACKUP_SERVICE_EXECSTART=$(systemctl show gsa-tv-backup.service -p ExecStart --value 2>/dev/null | sed -E 's/[[:space:]]+/ /g' | cut -c1-500 || true)"
    echo "BACKUP_SERVICE_FRAGMENT=$(systemctl show gsa-tv-backup.service -p FragmentPath --value 2>/dev/null || true)"
    echo "BACKUP_SERVICE_JOURNAL_BEGIN"
    journalctl -u gsa-tv-backup.service -n 40 --no-pager -o short-iso 2>/dev/null | sed -E 's#(postgres(ql)?://)[^ @]+@#\\1***@#g' || true
    echo "BACKUP_SERVICE_JOURNAL_END"
  fi
  echo "BACKUP_PREREQ_PSQL=$(command -v psql 2>/dev/null || echo missing)"
  echo "BACKUP_PREREQ_PG_DUMP=$(command -v pg_dump 2>/dev/null || echo missing)"
  echo "BACKUP_PREREQ_OPENSSL=$(command -v openssl 2>/dev/null || echo missing)"
  for p in /opt/gsa-tv/backup/gsa-tv-backup-full.sh /opt/gsa-tv/bin/backup-full.sh /home/opc/.gsa_tv_secret_key; do
    if [ -e "$p" ]; then
      stat -c 'BACKUP_PREREQ_PATH=%n TYPE=%F OWNER=%u:%g MODE=%a SIZE=%s' "$p" 2>/dev/null || true
    else
      echo "BACKUP_PREREQ_PATH=$p MISSING"
    fi
  done
  for p in /opt/gsa-tv/backups /opt/gsa-tv/backups/ffplayout /opt/gsa-tv/backups/full; do
    if [ -e "$p" ]; then
      stat -c 'BACKUP_PATH=%n TYPE=%F OWNER=%u:%g MODE=%a' "$p" 2>/dev/null || true
      du -sb "$p" 2>/dev/null | awk -v path="$p" '{print "BACKUP_BYTES=" $1 " PATH=" path}' || true
    else
      echo "BACKUP_PATH=$p MISSING"
    fi
  done
  if [ -d /opt/gsa-tv/cache/media ]; then
    find /opt/gsa-tv/cache/media -mindepth 1 -maxdepth 1 -type d -printf 'MEDIA_CHILD=%f\n' 2>/dev/null | sort | head -50 || true
  fi
  echo "RUNTIME_PATH_DIAGNOSTICS_END"
fi

if [ "${#missing_paths[@]}" -gt 0 ]; then
  echo "STATUS=BLOCKED"
  echo "REASON=missing_runtime_paths"
  exit 20
fi

exit "$exit_code"
