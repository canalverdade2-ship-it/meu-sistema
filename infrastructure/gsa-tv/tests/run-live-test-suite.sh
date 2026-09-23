#!/usr/bin/env bash
# GSA TV — homologação temporal baseada em evidência real.
# Uso: bash run-live-test-suite.sh <1-7>
set -euo pipefail

TEST_NUM="${1:-}"
case "$TEST_NUM" in
  1) DURATION=1800; LABEL="30 minutos" ;;
  2) DURATION=7200; LABEL="2 horas" ;;
  3) DURATION=21600; LABEL="6 horas" ;;
  4) DURATION=43200; LABEL="12 horas" ;;
  5) DURATION=86400; LABEL="24 horas" ;;
  6) DURATION=259200; LABEL="72 horas" ;;
  7) DURATION=604800; LABEL="7 dias" ;;
  *) echo "Informe um teste de 1 a 7." >&2; exit 2 ;;
esac

INTERVAL="${GSA_TV_TEST_INTERVAL_SECONDS:-60}"
CONTROL_URL="${GSA_TV_CONTROL_URL:-http://127.0.0.1:9202/health}"
ENCODER_URL="${GSA_TV_ENCODER_URL:-http://127.0.0.1:9210/health}"
WATCHDOG_URL="${GSA_TV_WATCHDOG_URL:-http://127.0.0.1:9204/metrics}"
READINESS_FILE="${GSA_TV_READINESS_FILE:-/opt/gsa-tv/runtime/autopilot/readiness-horizon.json}"
READINESS_MAX_AGE="${GSA_TV_READINESS_MAX_AGE_SECONDS:-1800}"
REQUIRE_AUTOPILOT="${GSA_TV_REQUIRE_AUTOPILOT:-1}"
REPORT_DIR="${GSA_TV_TEST_REPORT_DIR:-/opt/gsa-tv/logs/homologation}"
RUN_ID="test-${TEST_NUM}-$(date -u +%Y%m%dT%H%M%SZ)"
REPORT="$REPORT_DIR/${RUN_ID}.jsonl"
SUMMARY="$REPORT_DIR/${RUN_ID}.summary"
mkdir -p "$REPORT_DIR"
START_EPOCH=$(date +%s)
END_EPOCH=$((START_EPOCH + DURATION))
FAILURES=0
SAMPLES=0

echo "Iniciando teste $TEST_NUM ($LABEL) — duração real ${DURATION}s"

while (( $(date +%s) < END_EPOCH )); do
  TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  NOW=$(date +%s)
  CONTROL_OK=0
  ENCODER_OK=0
  WATCHDOG_OK=0
  READINESS_OK=0
  TIMERS_OK=0
  BLACK=1
  SILENCE=1
  FREEZE=1

  curl -fsS --max-time 5 "$CONTROL_URL" >/dev/null && CONTROL_OK=1 || true
  curl -fsS --max-time 5 "$ENCODER_URL" >/dev/null && ENCODER_OK=1 || true

  METRICS=$(curl -fsS --max-time 8 "$WATCHDOG_URL" 2>/dev/null || true)
  if grep -q '^gsa_tv_watchdog_up 1' <<<"$METRICS" && grep -q '^gsa_tv_hls_ok 1' <<<"$METRICS"; then
    WATCHDOG_OK=1
  fi
  BLACK=$(awk '/^gsa_tv_black_detected /{print $2}' <<<"$METRICS" | tail -1); BLACK=${BLACK:-1}
  SILENCE=$(awk '/^gsa_tv_silence_detected /{print $2}' <<<"$METRICS" | tail -1); SILENCE=${SILENCE:-1}
  FREEZE=$(awk '/^gsa_tv_freeze_detected /{print $2}' <<<"$METRICS" | tail -1); FREEZE=${FREEZE:-1}

  if [ "$REQUIRE_AUTOPILOT" = "1" ]; then
    if [ -s "$READINESS_FILE" ]; then
      MTIME=$(stat -c %Y "$READINESS_FILE" 2>/dev/null || echo 0)
      AGE=$((NOW - MTIME))
      if (( AGE >= 0 && AGE <= READINESS_MAX_AGE )); then READINESS_OK=1; fi
    fi
    if systemctl is-active --quiet gsa-tv-autopilot-readiness.timer        && systemctl is-active --quiet gsa-tv-autopilot-content-factory.timer; then
      TIMERS_OK=1
    fi
  else
    READINESS_OK=1
    TIMERS_OK=1
  fi

  SAMPLE_OK=1
  if (( CONTROL_OK != 1 || ENCODER_OK != 1 || WATCHDOG_OK != 1 || READINESS_OK != 1 || TIMERS_OK != 1 ))      || [[ "$BLACK" != "0" || "$SILENCE" != "0" || "$FREEZE" != "0" ]]; then
    SAMPLE_OK=0
    FAILURES=$((FAILURES + 1))
  fi
  SAMPLES=$((SAMPLES + 1))

  printf '{"ts":"%s","control_ok":%s,"encoder_ok":%s,"watchdog_ok":%s,"readiness_ok":%s,"timers_ok":%s,"black":%s,"silence":%s,"freeze":%s,"sample_ok":%s}\n'     "$TS" "$CONTROL_OK" "$ENCODER_OK" "$WATCHDOG_OK" "$READINESS_OK" "$TIMERS_OK" "$BLACK" "$SILENCE" "$FREEZE" "$SAMPLE_OK" >> "$REPORT"

  sleep "$INTERVAL"
done

END_ACTUAL=$(date +%s)
ELAPSED=$((END_ACTUAL - START_EPOCH))
RESULT="PASS"
if (( ELAPSED < DURATION || FAILURES > 0 )); then RESULT="FAIL"; fi

cat > "$SUMMARY" <<EOF
run_id=$RUN_ID
test=$TEST_NUM
label=$LABEL
required_seconds=$DURATION
elapsed_seconds=$ELAPSED
samples=$SAMPLES
failed_samples=$FAILURES
require_autopilot=$REQUIRE_AUTOPILOT
result=$RESULT
report=$REPORT
EOF
cat "$SUMMARY"
[[ "$RESULT" == "PASS" ]]
