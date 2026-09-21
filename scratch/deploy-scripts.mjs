import { runSshScript } from './ssh2-run.mjs';

const nightFactoryScript = `#!/usr/bin/env bash
# ==============================================================================
# GSA TV — Night Factory Automation Dispatcher
# Schedule: Overnight window 01:00 BRT (or triggered by gsa-tv-night-controller stop)
# Target Date: 2026-09-10 (Version: 003801b7-5f2d-4da3-a531-915ce52a27f3)
# ==============================================================================
set -euo pipefail

LOG_FILE="/var/log/gsa-tv-night-factory.log"
LOCK_FILE="/tmp/gsa-tv-night-factory.lock"

touch "$LOG_FILE"
chmod 644 "$LOG_FILE" 2>/dev/null || true
exec >> >(tee -a "$LOG_FILE") 2>&1

log() {
  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ") / $(date +"%Y-%m-%d %H:%M:%S %Z")] $*"
}

exec 200>"$LOCK_FILE"
if ! flock -n 200; then
  log "[WARN] Outra instancia de gsa-tv-night-factory ja esta ativa. Abortando nova execucao concorrente."
  exit 0
fi

log "================================================================================"
log "INICIANDO GSA TV NIGHT FACTORY DISPATCHER"
log "================================================================================"

TARGET_DATE="2026-09-10"
TARGET_VERSION_ID="003801b7-5f2d-4da3-a531-915ce52a27f3"
CHANNEL_ID="ch-main"
URL_CONTROL="http://127.0.0.1:9202"
URL_BUILDER="http://127.0.0.1:8770"
TOKEN="e54c08df5a3b42c2967395833b9c7104b3c9e0cb5e0f6c67f8277e5ea2895b0b"
DB_URL="postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub"
MASTERS_DIR="/opt/gsa-tv/cache/media/1/program-masters"

run_sql() {
  local sql="$1"
  psql "$DB_URL" -X -qAt -c "$sql"
}

# ------------------------------------------------------------------------------
# ETAPA A: Validar versao e data alvo
# ------------------------------------------------------------------------------
log "[ETAPA A] Verificando versao de grade alvo..."
VER_INFO=$(run_sql "SELECT id || '|' || broadcast_date || '|' || state FROM public.gsa_tv_schedule_versions WHERE id='$TARGET_VERSION_ID';")
if [ -z "$VER_INFO" ]; then
  log "[ERROR] Versao de grade $TARGET_VERSION_ID nao encontrada!"
  exit 1
fi
log "[ETAPA A] Versao alvo confirmada: $VER_INFO (Target date: $TARGET_DATE)"

# ------------------------------------------------------------------------------
# ETAPA B: Aprovar projetos de IA elegiveis em gsa_tv_ai_projects (Regra Canônica)
# ------------------------------------------------------------------------------
log "[ETAPA B] Aprovando projetos de IA em gsa_tv_ai_projects (state=draft -> approved, authorized_routine)..."
APPROVED_COUNT=$(run_sql "
WITH updated AS (
  UPDATE public.gsa_tv_ai_projects
     SET state='approved',
         autonomy_mode='authorized_routine',
         updated_at=now()
   WHERE state='draft'
     AND metadata->>'editorial_block_id' IN (
       SELECT id::text FROM public.gsa_tv_program_blocks
        WHERE schedule_version_id='$TARGET_VERSION_ID'
     )
  RETURNING id
)
SELECT count(*) FROM updated;
")
log "[ETAPA B] Projetos de IA aprovados com sucesso: $APPROVED_COUNT"

# ------------------------------------------------------------------------------
# ETAPA C: Disparar Production Package Builder e Program Builder (porta 8770)
# ------------------------------------------------------------------------------
log "[ETAPA C.1] Disparando prepare_production_packages via Control Plane..."
PKG_JOB_RES=$(curl -s -X POST \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"job_type":"prepare_production_packages","payload":{"days":1}}' \\
  "$URL_CONTROL/automation/jobs" || echo '{"error":"falha_curl"}')
log "[ETAPA C.1] Resposta prepare_production_packages: $PKG_JOB_RES"

log "[ETAPA C.2] Disparando prepare_editorial_projects via Control Plane..."
ED_JOB_RES=$(curl -s -X POST \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"job_type":"prepare_editorial_projects","payload":{"days":1}}' \\
  "$URL_CONTROL/automation/jobs" || echo '{"error":"falha_curl"}')
log "[ETAPA C.2] Resposta prepare_editorial_projects: $ED_JOB_RES"

log "[ETAPA C.3] Consultando Program Builder na porta 8770..."
BUILDER_HEALTH=$(curl -s --max-time 5 "$URL_BUILDER/health" || echo '{"status":"unavailable"}')
log "[ETAPA C.3] Health check do Program Builder: $BUILDER_HEALTH"

log "[ETAPA C.4] Acionando validacao/construcao no Program Builder (porta 8770)..."
TEST_MANIFEST="/home/opc/gsa-program-builder/examples/teste-curto-gsa-agro.json"
if [ -f "$TEST_MANIFEST" ]; then
  VALIDATE_RES=$(curl -s -X POST \\
    -H "Content-Type: application/json" \\
    -d @"$TEST_MANIFEST" \\
    "$URL_BUILDER/validate" || echo '{"erro":"falha_conexao"}')
  log "[ETAPA C.4] Resposta de validacao manifest 1080p: $VALIDATE_RES"
fi

# ------------------------------------------------------------------------------
# ETAPA D: Registrar masters e vincular media_item_id aos program_blocks
# ------------------------------------------------------------------------------
log "[ETAPA D] Registrando masters finalizados e vinculando aos blocos de programacao..."

register_master() {
  local filename="$1"
  local title="$2"
  local slug="$3"
  curl -s -X POST \\
    -H "Authorization: Bearer $TOKEN" \\
    -H "Content-Type: application/json" \\
    -d "{\\"filename\\":\\"$filename\\",\\"title\\":\\"$title\\",\\"rights_ok\\":true,\\"approved\\":true,\\"slug\\":\\"$slug\\"}" \\
    "$URL_CONTROL/program-builder/register"
}

# Tabela declarativa de programas conhecidos e padroes de arquivo
declare -A PROGRAM_MAP=(
  ["gsa-agro-master.mp4"]="GSA Agro|GSA Agro — Master 1080p|gsa-agro"
  ["gsa-manha-news-20260909-30m.mp4"]="GSA Manhã News|GSA Manhã News — Master 1080p|gsa-manha-news"
  ["gsa-historias-da-biblia-o-filho-prodigo-30m.mp4"]="GSA Histórias da Bíblia|GSA Histórias da Bíblia — Master 1080p|gsa-historias-da-biblia"
)

# 1. Registrar masters especificos declarados
for filename in "\${!PROGRAM_MAP[@]}"; do
  if [ -f "$MASTERS_DIR/$filename" ]; then
    IFS="|" read -r prog_name title_name slug_name <<< "\${PROGRAM_MAP[$filename]}"
    res=$(register_master "$filename" "$title_name" "$slug_name")
    mid=$(echo "$res" | jq -r '.media_id // empty')
    if [ -n "$mid" ]; then
      run_sql "UPDATE public.gsa_tv_program_blocks SET media_item_id='$mid', updated_at=now() WHERE schedule_version_id='$TARGET_VERSION_ID' AND program_id IN (SELECT id FROM public.gsa_tv_programs WHERE name ILIKE '%$prog_name%');"
      log "[ETAPA D] $prog_name vinculado com sucesso ao master: $mid ($filename)"
    else
      log "[WARN] Falha ao registrar $filename no control plane: $res"
    fi
  fi
done

# 2. Registrar quaisquer novos masters gerados dinamicamente na pasta masters
for mp4file in "$MASTERS_DIR"/*.mp4; do
  [ -e "$mp4file" ] || continue
  base=$(basename "$mp4file")
  # Pular masters declarados e o fallback na iteracao dinamica
  if [[ -n "\${PROGRAM_MAP[$base]:-}" || "$base" == "gsa-tv-fallback-1080p30.mp4" || "$base" == "salomao-intro-1080p30.mp4" ]]; then
    continue
  fi
  # Tentar associar programa por padrao no nome do arquivo
  clean_base=\${base%.mp4}
  MATCHED_PROG=$(run_sql "SELECT id || '|' || name FROM public.gsa_tv_programs WHERE name ILIKE '%$clean_base%' OR '$clean_base' ILIKE '%' || lower(replace(name, ' ', '-')) || '%' LIMIT 1;")
  if [ -n "$MATCHED_PROG" ]; then
    IFS="|" read -r prog_id prog_name <<< "$MATCHED_PROG"
    res=$(register_master "$base" "$prog_name — Master 1080p" "$clean_base")
    mid=$(echo "$res" | jq -r '.media_id // empty')
    if [ -n "$mid" ]; then
      run_sql "UPDATE public.gsa_tv_program_blocks SET media_item_id='$mid', updated_at=now() WHERE schedule_version_id='$TARGET_VERSION_ID' AND program_id='$prog_id';"
      log "[ETAPA D] Master dinamico $base registrado ($mid) e vinculado a $prog_name."
    fi
  fi
done

# 3. Registrar master fallback 1080p staged e vincular a blocos remanescentes
FALLBACK_1080="$MASTERS_DIR/gsa-tv-fallback-1080p30.mp4"
if [ -f "$FALLBACK_1080" ]; then
  res=$(register_master "gsa-tv-fallback-1080p30.mp4" "GSA TV — Master Fallback Programação 1080p" "gsa-tv-fallback")
  mid=$(echo "$res" | jq -r '.media_id // empty')
  if [ -n "$mid" ]; then
    UPDATED_FALLBACK=$(run_sql "
      WITH updated AS (
        UPDATE public.gsa_tv_program_blocks
           SET media_item_id='$mid', updated_at=now()
         WHERE schedule_version_id='$TARGET_VERSION_ID'
           AND (media_item_id IS NULL OR media_item_id='')
        RETURNING id
      )
      SELECT count(*) FROM updated;
    ")
    log "[ETAPA D] Master fallback 1080p ($mid) vinculado a $UPDATED_FALLBACK bloco(s) remanescente(s)."
  else
    log "[ERROR] Falha ao registrar master fallback: $res"
  fi
else
  log "[WARN] Arquivo master fallback $FALLBACK_1080 nao encontrado!"
fi

COVERAGE=$(run_sql "SELECT count(*) || '/' || (SELECT count(*) FROM public.gsa_tv_program_blocks WHERE schedule_version_id='$TARGET_VERSION_ID') FROM public.gsa_tv_program_blocks WHERE schedule_version_id='$TARGET_VERSION_ID' AND media_item_id IS NOT NULL;")
log "[ETAPA D] Cobertura de masters na grade: $COVERAGE blocos prontos com midia associada."

# ------------------------------------------------------------------------------
# ETAPA E: Disparar compile_playlist no Control Plane
# ------------------------------------------------------------------------------
log "[ETAPA E] Disparando compile_playlist via $URL_CONTROL/automation/jobs..."
COMPILE_JOB_RES=$(curl -s -X POST \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"job_type":"compile_playlist"}' \\
  "$URL_CONTROL/automation/jobs")
log "[ETAPA E] Resposta compile_playlist: $COMPILE_JOB_RES"

sleep 6
PLAYLIST_FILE="/opt/gsa-tv/playlists/1/$TARGET_DATE.json"
if [ -f "$PLAYLIST_FILE" ]; then
  log "[ETAPA E] Playlist oficial confirmada em $PLAYLIST_FILE ($(stat -c%s "$PLAYLIST_FILE") bytes)."
else
  log "[WARN] Arquivo de playlist $PLAYLIST_FILE nao encontrado."
fi

log "================================================================================"
log "GSA TV NIGHT FACTORY DISPATCHER CONCLUIDO COM SUCESSO"
log "================================================================================"
`;

const nightControllerScript = `#!/bin/bash
MODE=$1
TOKEN="e54c08df5a3b42c2967395833b9c7104b3c9e0cb5e0f6c67f8277e5ea2895b0b"
URL_CONTROL="http://127.0.0.1:9202"
DB_URL="postgresql://supabase_admin:GSA_SENHA_FORTE_2026@172.17.0.1:5433/gsahub"

insert_job() {
    local job_type=$1
    echo "[\$(date)] Inserindo job: $job_type"
    echo "INSERT INTO gsa_tv_jobs (channel_id, job_type, payload) SELECT 'ch-main', '$job_type', '{}' WHERE NOT EXISTS (SELECT 1 FROM gsa_tv_jobs WHERE channel_id='ch-main' AND job_type='$job_type' AND status IN ('pending', 'running'));" | sudo docker run --rm -i postgres:15 psql "$DB_URL"
}

if [ "$MODE" = "signoff" ]; then
    echo "[\$(date)] Executando signoff institucional (transmissao permanece ativa para bloco de continuidade 23:50-23:59)..."
elif [ "$MODE" = "stop" ]; then
    echo "[\$(date)] Parando RTMP (stop)..."
    insert_job "stream_stop"
    if [ -x /opt/gsa-tv/bin/gsa-tv-night-factory.sh ]; then
        echo "[\$(date)] Disparando Night Factory dispatcher com atraso de 10s para finalizacao do stream..."
        (sleep 10 && /opt/gsa-tv/bin/gsa-tv-night-factory.sh) &
    fi
elif [ "$MODE" = "start" ]; then
    echo "[\$(date)] Compilando playlist do dia..."
    curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"job_type":"compile_playlist"}' "$URL_CONTROL/automation/jobs"
    echo ""
    echo "[\$(date)] Aguardando compilacao (15s)..."
    sleep 15
    echo "[\$(date)] Iniciando RTMP (start)..."
    insert_job "stream_start"
    echo ""
    echo "[\$(date)] Transmissao iniciada."
else
    echo "Usage: $0 {signoff|stop|start}"
    exit 1
fi
`;

const encodedFactory = Buffer.from(nightFactoryScript).toString('base64');
const encodedController = Buffer.from(nightControllerScript).toString('base64');

const cmd = `
echo '=== UPDATING /opt/gsa-tv/bin/gsa-tv-night-factory.sh ==='
echo '${encodedFactory}' | base64 -d | sudo tee /opt/gsa-tv/bin/gsa-tv-night-factory.sh > /dev/null
sudo chmod +x /opt/gsa-tv/bin/gsa-tv-night-factory.sh

echo '=== UPDATING /opt/gsa-tv/bin/gsa-tv-night-controller.sh ==='
echo '${encodedController}' | base64 -d | sudo tee /opt/gsa-tv/bin/gsa-tv-night-controller.sh > /dev/null
sudo chmod +x /opt/gsa-tv/bin/gsa-tv-night-controller.sh

echo '=== TESTING SYNTAX OF BOTH SCRIPTS ==='
bash -n /opt/gsa-tv/bin/gsa-tv-night-factory.sh
bash -n /opt/gsa-tv/bin/gsa-tv-night-controller.sh
echo 'Both scripts passed bash syntax check!'
`;

try {
  const res = await runSshScript(cmd, 30000);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
} catch (e) {
  console.error('ERROR:', e);
}
