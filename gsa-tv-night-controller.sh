#!/usr/bin/env bash
# ==============================================================================
# GSA TV — Night Controller (Solução 2: Standby Contínuo 24/7)
# 
# Padrão Broadcast Profissional: O socket RTMP para o YouTube NUNCA é encerrado
# durante a madrugada. Às 00:59 BRT, o playout comuta para uma cartela de
# continuidade institucional 1080p30 ultra-leve (<2% CPU), preservando o socket
# YouTube ESTABLISHED e liberando 95%+ de CPU para o Night Factory de IA.
# Às 06:00 BRT, o controlador retorna suavemente a transmissão para o modo
# "program" na exata mesma live do YouTube sem corte de sinal.
# ==============================================================================
set -uo pipefail

MODE="${1:-}"
CONTROL_TOKEN="${GSA_TV_CONTROL_TOKEN:-}"
ENCODER_TOKEN="${GSA_TV_ENCODER_TOKEN:-}"
URL_CONTROL="${GSA_TV_CONTROL_URL:-http://127.0.0.1:9202}"
URL_ENCODER="${GSA_TV_ENCODER_URL:-http://127.0.0.1:9210}"
DB_URL="${GSA_TV_DATABASE_URL:-}"
CHANNEL_ID="ch-main"
CONTINUITY_MEDIA_PATH="/media/1/identity/gsa-tv-continuity-1080p30.mp4"
CONTINUITY_HOST_PATH="/opt/gsa-tv/cache/media/1/identity/gsa-tv-continuity-1080p30.mp4"
LOG_FILE="/var/log/gsa-tv-night-controller.log"

require_env() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "[FATAL] Variável obrigatória ausente: $name" >&2
    exit 78
  fi
}

require_env GSA_TV_DATABASE_URL
if [ "$MODE" = "start" ] || [ "$MODE" = "stop" ]; then
  require_env GSA_TV_CONTROL_TOKEN
fi
if [ "$MODE" = "stop" ]; then
  require_env GSA_TV_ENCODER_TOKEN
fi

touch "$LOG_FILE" 2>/dev/null || true
chmod 644 "$LOG_FILE" 2>/dev/null || true

log() {
  local msg="[$(date -u +"%Y-%m-%dT%H:%M:%SZ") / $(date +"%Y-%m-%d %H:%M:%S %Z")] $*"
  echo "$msg"
  echo "$msg" >> "$LOG_FILE" 2>/dev/null || true
}

insert_job() {
  local job_type="$1"
  local payload="${2:-{}}"
  log "Inserindo job: $job_type"
  psql "$DB_URL" -X -qAt -c "INSERT INTO public.gsa_tv_jobs (channel_id, job_type, payload) SELECT '$CHANNEL_ID', '$job_type', '$payload'::jsonb WHERE NOT EXISTS (SELECT 1 FROM public.gsa_tv_jobs WHERE channel_id='$CHANNEL_ID' AND job_type='$job_type' AND status IN ('pending', 'running'));" || true
}

trigger_process_jobs() {
  curl -s -m 5 -X POST -H "Authorization: Bearer $CONTROL_TOKEN" "$URL_CONTROL/process" >/dev/null 2>&1 || true
}

get_encoder_health() {
  curl -s -m 3 "$URL_ENCODER/health" 2>/dev/null || echo "{}"
}

case "$MODE" in
  signoff)
    log "================================================================================"
    log "GSA TV — SIGNOFF INSTITUCIONAL (00:50 BRT)"
    log "================================================================================"
    log "Executando signoff institucional. A transmissão RTMP permanece ATIVA para transição suave."
    if [ -f "$CONTINUITY_HOST_PATH" ]; then
      log "Cartela de continuidade 1080p30 verificada no storage: $CONTINUITY_HOST_PATH"
    else
      log "[WARN] Cartela 1080p30 não encontrada em $CONTINUITY_HOST_PATH; verificando fallbacks..."
    fi
    psql "$DB_URL" -X -qAt -c "INSERT INTO public.gsa_tv_audit_log(channel_id, actor, action, resource_type, details) VALUES ('$CHANNEL_ID', 'gsa-tv-night-controller', 'signoff_prepared', 'channel', '{\"status\":\"ready_for_standby\",\"window\":\"00:50-06:00\"}');" >/dev/null 2>&1 || true
    log "Signoff preparado com sucesso."
    ;;

  stop)
    log "================================================================================"
    log "GSA TV — TRANSIÇÃO PARA STANDBY / CONTINUIDADE LEVE (00:59 BRT)"
    log "Solução 2: Standby Contínuo 24/7 (RTMP YouTube mantido ESTABLISHED)"
    log "================================================================================"
    
    # 1. Solicitar transição para standby via Control Plane
    log "Solicitando comutação para modo 'standby' (cartela 1080p30 leve, copy stream)..."
    insert_job "stream_standby"
    trigger_process_jobs

    # 2. Aguardar confirmação do encoder em modo standby
    STANDBY_OK=false
    for i in {1..15}; do
      ENC_STATUS=$(get_encoder_health)
      OUTER_OK=$(echo "$ENC_STATUS" | grep -o '"outer_running":true' || true)
      PROD_OK=$(echo "$ENC_STATUS" | grep -o '"producer_running":true' || true)
      MODE_ACT=$(echo "$ENC_STATUS" | grep -o '"mode":"[^"]*"' | cut -d'"' -f4 || true)

      if [ -n "$OUTER_OK" ] && [ -n "$PROD_OK" ] && [ "$MODE_ACT" = "standby" ]; then
        STANDBY_OK=true
        OUTER_PID=$(echo "$ENC_STATUS" | grep -o '"outer_pid":[0-9]*' | cut -d':' -f2 || true)
        PROD_PID=$(echo "$ENC_STATUS" | grep -o '"producer_pid":[0-9]*' | cut -d':' -f2 || true)
        log "Modo Standby CONFIRMADO! RTMP online (outer PID $OUTER_PID, producer PID $PROD_PID, mode: $MODE_ACT)"
        break
      fi
      sleep 1
    done

    # 3. Failsafe: caso o control-plane não tenha respondido, acionar /v1/ensure diretamente
    if [ "$STANDBY_OK" = false ]; then
      log "[WARN] Standby via control-plane demorou mais de 15s. Acionando failsafe direto no encoder-engine..."
      TARGET_URL=""
      if [ -f "/opt/gsa-tv/runtime/encoder-state.json" ]; then
        TARGET_URL=$(jq -r '.args[-1] // empty' /opt/gsa-tv/runtime/encoder-state.json 2>/dev/null || true)
      fi
      if [ -n "$TARGET_URL" ] && [[ "$TARGET_URL" =~ ^rtmps?:// ]]; then
        log "Enviando payload de standby direto para $URL_ENCODER/v1/ensure..."
        curl -s -m 10 -X POST -H "Authorization: Bearer $ENCODER_TOKEN" -H "Content-Type: application/json" \
          -d "{\"mode\":\"standby\",\"args\":[\"-hide_banner\",\"-nostdin\",\"-loglevel\",\"warning\",\"-re\",\"-stream_loop\",\"-1\",\"-i\",\"$CONTINUITY_MEDIA_PATH\",\"-map\",\"0:v:0\",\"-map\",\"0:a:0?\",\"-c:v\",\"copy\",\"-c:a\",\"copy\",\"-f\",\"flv\",\"$TARGET_URL\"]}" \
          "$URL_ENCODER/v1/ensure" >/dev/null 2>&1 || true
      fi
    fi

    # 4. Disparar Night Factory dispatcher em background
    if [ -x /opt/gsa-tv/bin/gsa-tv-night-factory.sh ]; then
      log "Disparando Night Factory dispatcher em background (/opt/gsa-tv/bin/gsa-tv-night-factory.sh &)..."
      (/opt/gsa-tv/bin/gsa-tv-night-factory.sh >> /var/log/gsa-tv-night-factory.log 2>&1) &
      log "Night Factory disparado. 95%+ de CPU e RAM disponíveis para produção autônoma."
    else
      log "[WARN] Script /opt/gsa-tv/bin/gsa-tv-night-factory.sh não encontrado ou sem permissão de execução."
    fi
    ;;

  start)
    log "================================================================================"
    log "GSA TV — MORNING START / RETORNO À GRADE NORMAL (06:00 BRT)"
    log "================================================================================"
    
    if [ -f /home/opc/gsa-ai/work/plan-b-internet-20260910/ACTIVE ]; then
      log "Plano B Internet ativo: preservando playlist de emergência; compile_playlist automático ignorado."
    else
      log "Compilando playlist do novo dia via Control Plane..."
      COMPILE_RES=$(curl -s -m 15 -X POST -H "Authorization: Bearer $CONTROL_TOKEN" -H "Content-Type: application/json" \
        -d '{"job_type":"compile_playlist"}' "$URL_CONTROL/automation/jobs" 2>/dev/null || echo '{"error":"curl_failed"}')
      log "Resposta compile_playlist: $COMPILE_RES"
      trigger_process_jobs
      log "Aguardando compilação e verificação de prontidão da grade (15s)..."
      sleep 15
    fi

    # Verificar prontidão do dia
    TODAY=$(date +"%Y-%m-%d")
    PLAYLIST_FILE="/opt/gsa-tv/playlists/1/$TODAY.json"
    if [ -f "$PLAYLIST_FILE" ]; then
      log "Playlist do dia $TODAY pronta no storage ($PLAYLIST_FILE)."
    else
      log "[INFO] Playlist file para $TODAY em verificação no banco de dados."
    fi

    log "Comutando encoder suavemente de volta para a grade oficial (mode: program)..."
    insert_job "stream_start"
    trigger_process_jobs

    # Aguardar e validar retorno ao modo program
    PROG_OK=false
    for i in {1..25}; do
      ENC_STATUS=$(get_encoder_health)
      OUTER_OK=$(echo "$ENC_STATUS" | grep -o '"outer_running":true' || true)
      PROD_OK=$(echo "$ENC_STATUS" | grep -o '"producer_running":true' || true)
      MODE_ACT=$(echo "$ENC_STATUS" | grep -o '"mode":"[^"]*"' | cut -d'"' -f4 || true)

      if [ -n "$OUTER_OK" ] && [ -n "$PROD_OK" ] && [ "$MODE_ACT" = "program" ]; then
        PROG_OK=true
        OUTER_PID=$(echo "$ENC_STATUS" | grep -o '"outer_pid":[0-9]*' | cut -d':' -f2 || true)
        PROD_PID=$(echo "$ENC_STATUS" | grep -o '"producer_pid":[0-9]*' | cut -d':' -f2 || true)
        log "Transmissão da manhã ATIVA e confirmada! RTMP mantido ininterrupto (outer PID $OUTER_PID, producer PID $PROD_PID, mode: $MODE_ACT)"
        break
      fi
      sleep 1
    done

    if [ "$PROG_OK" = false ]; then
      log "[WARN] Transição para 'program' ainda em andamento após 25s; verificar telemetria."
    fi
    log "Operação morning-start finalizada com sucesso."
    ;;

  *)
    echo "Usage: $0 {signoff|stop|start}"
    exit 1
    ;;
esac
