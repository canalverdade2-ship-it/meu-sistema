#!/usr/bin/env bash
# Proves that Control Plane replacement does not restart the independent RTMP transport.
# This is a production mutation and requires explicit acknowledgement.
set -euo pipefail

if [ "${1:-}" != "--confirm-live-chaos" ]; then
  echo "Uso: sudo $0 --confirm-live-chaos" >&2
  echo "O teste reinicia somente gsa-tv-control-plane e nunca para o Encoder Engine." >&2
  exit 64
fi

[ "$(id -u)" -eq 0 ] || { echo "Execute como root/sudo." >&2; exit 77; }

ENV_FILE="${GSA_TV_ENV_FILE:-/opt/gsa-tv/control-plane/.env}"
PRECHECK="${GSA_TV_PREFLIGHT:-/opt/gsa-tv/bin/autopilot-runtime-preflight.sh}"
[ -x "$PRECHECK" ] || { echo "Preflight do Autopilot não instalado." >&2; exit 78; }
[ -f "$ENV_FILE" ] || { echo "Env protegido não encontrado." >&2; exit 78; }

set +e
PREFLIGHT="$("$PRECHECK" 2>&1)"
PREFLIGHT_RC=$?
set -e
printf '%s\n' "$PREFLIGHT"
[ "$PREFLIGHT_RC" -eq 0 ] || { echo "Runtime não está EXTERNAL_READY." >&2; exit 75; }
grep -q '^STATUS=EXTERNAL_READY$' <<<"$PREFLIGHT"
grep -q '^DESIRED_STATE=running$' <<<"$PREFLIGHT"
grep -q '^SIGNAL_STATE=sending$' <<<"$PREFLIGHT"

token="$(awk -F= '$1=="ENCODER_ENGINE_TOKEN"{sub(/^[^=]*=/,"");print;exit}' "$ENV_FILE")"
[ "${#token}" -ge 32 ] || { echo "ENCODER_ENGINE_TOKEN inválido." >&2; exit 78; }

encoder_status() {
  curl -fsS --max-time 5 -H "Authorization: Bearer $token"     http://127.0.0.1:9210/v1/status
}

BEFORE="$(encoder_status)"
read -r BEFORE_OUTER BEFORE_PRODUCER BEFORE_OUTER_OK BEFORE_PRODUCER_OK < <(
  printf '%s' "$BEFORE" | python3 -c '
import json,sys
x=json.load(sys.stdin)
print(x.get("outer_pid") or 0, x.get("producer_pid") or 0,
      int(bool(x.get("outer_running"))), int(bool(x.get("producer_running"))))
'
)
[ "$BEFORE_OUTER_OK" = "1" ] && [ "$BEFORE_PRODUCER_OK" = "1" ] || {
  echo "Encoder não está estável antes do teste." >&2
  exit 80
}

START=$(date +%s)
docker restart --time 15 gsa-tv-control-plane >/dev/null

deadline=$((SECONDS + 90))
until curl -fsS --max-time 3 http://127.0.0.1:9202/health >/dev/null 2>&1; do
  [ "$SECONDS" -lt "$deadline" ] || { echo "Control Plane não recuperou health." >&2; exit 81; }
  sleep 2
done

AFTER="$(encoder_status)"
read -r AFTER_OUTER AFTER_PRODUCER AFTER_OUTER_OK AFTER_PRODUCER_OK < <(
  printf '%s' "$AFTER" | python3 -c '
import json,sys
x=json.load(sys.stdin)
print(x.get("outer_pid") or 0, x.get("producer_pid") or 0,
      int(bool(x.get("outer_running"))), int(bool(x.get("producer_running"))))
'
)

[ "$AFTER_OUTER_OK" = "1" ] && [ "$AFTER_PRODUCER_OK" = "1" ] || {
  echo "Encoder deixou de estar ativo após restart do Control Plane." >&2
  exit 82
}
[ "$BEFORE_OUTER" = "$AFTER_OUTER" ] || {
  echo "FAIL: PID do transporte RTMP mudou ($BEFORE_OUTER -> $AFTER_OUTER)." >&2
  exit 83
}
[ "$BEFORE_PRODUCER" = "$AFTER_PRODUCER" ] || {
  echo "FAIL: PID do produtor mudou ($BEFORE_PRODUCER -> $AFTER_PRODUCER)." >&2
  exit 84
}

METRICS="$(curl -fsS --max-time 8 http://127.0.0.1:9204/metrics)"
grep -q '^gsa_tv_hls_ok 1' <<<"$METRICS"

ELAPSED=$(( $(date +%s) - START ))
echo "PASS control_plane_restart_continuity"
echo "outer_pid_preserved=$AFTER_OUTER"
echo "producer_pid_preserved=$AFTER_PRODUCER"
echo "control_plane_recovery_seconds=$ELAPSED"
unset token BEFORE AFTER
