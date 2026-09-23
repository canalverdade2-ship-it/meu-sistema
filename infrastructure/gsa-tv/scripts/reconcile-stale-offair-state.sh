#!/usr/bin/env bash
# Reconcile stale logical channel state only after proving the VPS is physically off-air.
# Dry-run by default. --apply updates only public.gsa_tv_channels for ch-main and
# writes before/after evidence under /opt/gsa-tv/backups/offair-reconcile.
set -euo pipefail

APPLY=false
CHANNEL_ID="${GSA_TV_CHANNEL_ID:-ch-main}"
BASE="${GSA_TV_BASE:-/opt/gsa-tv}"
ENV_FILE="${GSA_TV_ENV_FILE:-$BASE/control-plane/.env}"
EVIDENCE_ROOT="${GSA_TV_OFFAIR_EVIDENCE_ROOT:-$BASE/backups/offair-reconcile}"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --apply) APPLY=true ;;
    -h|--help)
      echo "Usage: reconcile-stale-offair-state.sh [--apply]"
      exit 0
      ;;
    *) echo "Unknown argument: $1" >&2; exit 64 ;;
  esac
  shift
done

command -v docker >/dev/null
command -v psql >/dev/null

[ -f "$ENV_FILE" ] || { echo "BLOCKED: env file missing: $ENV_FILE" >&2; exit 78; }
DB_URL="$(awk -F= '$1=="DATABASE_URL"{sub(/^[^=]*=/,"");print;exit}' "$ENV_FILE")"
[ -n "$DB_URL" ] || { echo "BLOCKED: DATABASE_URL missing." >&2; exit 78; }

container_running() {
  [ "$(docker inspect -f '{{.State.Running}}' "$1" 2>/dev/null || true)" = "true" ]
}

host_rtmp_ffmpeg_count="$(ps -eo args 2>/dev/null | grep '[f]fmpeg' | grep -Eic 'rtmps?://|(^|[[:space:]])-f[[:space:]]+flv([[:space:]]|$)' || true)"
stream_socket_count=0
if command -v ss >/dev/null 2>&1; then
  stream_socket_count="$(ss -Htnp state established 2>/dev/null | grep -Eic 'ffplayout|ffmpeg' || true)"
fi

control_running=false
encoder_running=false
ffplayout_running=false
container_running gsa-tv-control-plane && control_running=true || true
container_running gsa-tv-encoder-engine && encoder_running=true || true
container_running gsa-tv-ffplayout && ffplayout_running=true || true

physical_off_air=false
if [ "$control_running" = false ] &&
   [ "$encoder_running" = false ] &&
   [ "${host_rtmp_ffmpeg_count:-0}" = "0" ] &&
   [ "${stream_socket_count:-0}" = "0" ]; then
  physical_off_air=true
fi

before="$(psql "$DB_URL" -X -qAt -F '|' -v ON_ERROR_STOP=1 -c "select coalesce(desired_state,'unknown'),coalesce(signal_state,'unknown'),coalesce(playout_state,'unknown'),coalesce(to_jsonb(c)->>'updated_at','unknown') from public.gsa_tv_channels c where id='${CHANNEL_ID}' limit 1")"
[ -n "$before" ] || { echo "BLOCKED: channel not found: $CHANNEL_ID" >&2; exit 79; }

echo "OFFAIR_RECONCILE_PLAN_BEGIN"
echo "channel_id=$CHANNEL_ID"
echo "physical_off_air=$physical_off_air"
echo "control_plane_running=$control_running"
echo "encoder_engine_running=$encoder_running"
echo "ffplayout_running=$ffplayout_running"
echo "host_rtmp_ffmpeg_count=$host_rtmp_ffmpeg_count"
echo "stream_socket_count=$stream_socket_count"
echo "before_state=$before"
echo "target_state=stopped|stopped|off_air"
echo "OFFAIR_RECONCILE_PLAN_END"

[ "$physical_off_air" = true ] || {
  echo "BLOCKED: physical off-air evidence is not clean." >&2
  exit 75
}

if [ "$APPLY" != true ]; then
  echo "DRY_RUN_OK=true"
  exit 0
fi

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
evidence="$EVIDENCE_ROOT/$stamp"
install -d -m 0700 "$evidence"

{
  echo "channel_id=$CHANNEL_ID"
  echo "created_at_utc=$(date -u +%FT%TZ)"
  echo "physical_off_air=$physical_off_air"
  echo "control_plane_running=$control_running"
  echo "encoder_engine_running=$encoder_running"
  echo "ffplayout_running=$ffplayout_running"
  echo "host_rtmp_ffmpeg_count=$host_rtmp_ffmpeg_count"
  echo "stream_socket_count=$stream_socket_count"
  echo "before_state=$before"
} > "$evidence/before.txt"

updated="$(psql "$DB_URL" -X -qAt -F '|' -v ON_ERROR_STOP=1 <<SQL
begin;
select id from public.gsa_tv_channels where id='$CHANNEL_ID' for update;
update public.gsa_tv_channels
   set desired_state='stopped',
       signal_state='stopped',
       playout_state='off_air',
       updated_at=now()
 where id='$CHANNEL_ID'
returning coalesce(desired_state,'unknown'),
          coalesce(signal_state,'unknown'),
          coalesce(playout_state,'unknown'),
          updated_at::text;
commit;
SQL
)"
after="$(printf '%s\n' "$updated" | grep -E '^stopped\|stopped\|off_air\|' | tail -1 || true)"
[ -n "$after" ] || {
  echo "BLOCKED: state reconciliation did not return the required target state." >&2
  exit 80
}

printf '%s\n' "$after" > "$evidence/after.txt"
(
  cd "$evidence"
  sha256sum before.txt after.txt > manifest.sha256
  sha256sum -c manifest.sha256 >/dev/null
)

echo "OFFAIR_RECONCILE_APPLIED=true"
echo "AFTER_STATE=$after"
echo "EVIDENCE_DIR=$evidence"
