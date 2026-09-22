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
if [ -f "$ENV_FILE" ]; then
  env_present=true
  grep -q '^DATABASE_URL=.' "$ENV_FILE" && db_configured=true || true
  token_len="$(awk -F= '$1=="ENCODER_ENGINE_TOKEN"{sub(/^[^=]*=/,"");print length($0);exit}' "$ENV_FILE" 2>/dev/null || true)"
  if [ -n "$token_len" ] && [ "$token_len" -ge 32 ]; then encoder_token_configured=true; fi
fi

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

first_migration_offair_ready=false
if [ "$desired_state" = "stopped" ] &&
   [ "$signal_state" = "stopped" ] &&
   [ "$playout_state" = "off_air" ]; then
  first_migration_offair_ready=true
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
echo "ENV_FILE_PRESENT=$env_present"
echo "DATABASE_CONFIGURED=$db_configured"
echo "ENCODER_TOKEN_CONFIGURED=$encoder_token_configured"
echo "MISSING_PATHS=${missing_paths[*]:-none}"

if [ "${#missing_paths[@]}" -gt 0 ]; then
  echo "STATUS=BLOCKED"
  echo "REASON=missing_runtime_paths"
  exit 20
fi

exit "$exit_code"
