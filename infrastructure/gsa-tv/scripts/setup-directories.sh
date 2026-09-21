#!/usr/bin/env bash
# GSA TV — prepara os diretórios persistentes para a pilha completa (Fases 2–6)
# Uso: sudo bash setup-directories.sh
# Deve ser executado UMA VEZ na VPS antes de levantar o compose.yml completo.
set -euo pipefail

GSA_TV_USER="${GSA_TV_USER:-gsa-tv}"
GSA_TV_GROUP="${GSA_TV_GROUP:-gsa-tv}"

echo "[GSA-TV] Criando árvore de diretórios persistentes..."

# Diretórios raiz
install -d -o root -g root -m 0755 /opt/gsa-tv

# Serviços principais
for DIR in \
  /opt/gsa-tv/config/ffplayout \
  /opt/gsa-tv/secrets \
  /opt/gsa-tv/playlists \
  /opt/gsa-tv/fallback \
  /opt/gsa-tv/preview/hls \
  /opt/gsa-tv/cache/media/incoming \
  /opt/gsa-tv/cache/media/normalized \
  /opt/gsa-tv/cache/media/programs \
  /opt/gsa-tv/cache/media/advertising \
  /opt/gsa-tv/cache/media/identity \
  /opt/gsa-tv/cache/media/live-recordings \
  /opt/gsa-tv/cache/media/ai-generated \
  /opt/gsa-tv/cache/media/documents \
  /opt/gsa-tv/cache/media/synthetic \
  /opt/gsa-tv/backups/ffplayout; do
  install -d -o "${GSA_TV_USER}" -g "${GSA_TV_GROUP}" -m 0750 "$DIR"
  echo "  OK: $DIR"
done

# Logs por serviço
for SVC in ffplayout media-worker cache-manager playout-api playlist-compiler; do
  install -d -o "${GSA_TV_USER}" -g "${GSA_TV_GROUP}" -m 0750 "/opt/gsa-tv/logs/${SVC}"
  echo "  OK: /opt/gsa-tv/logs/${SVC}"
done

# Scripts (somente leitura pelos containers)
install -d -o root -g root -m 0755 /opt/gsa-tv/scripts

# Monitoramento
for DIR in \
  /opt/gsa-tv/monitoring/prometheus-data \
  /opt/gsa-tv/monitoring/grafana-data \
  /opt/gsa-tv/monitoring/uptime-kuma-data \
  /opt/gsa-tv/monitoring/rules; do
  install -d -o root -g root -m 0755 "$DIR"
  echo "  OK: $DIR"
done

# Secrets: modo 700 para o diretório, 600 para arquivos individuais
chmod 700 /opt/gsa-tv/secrets

echo ""
echo "[GSA-TV] Copiando scripts de preset para /opt/gsa-tv/scripts/..."
SCRIPT_SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
for SCRIPT in \
  preset-validate.sh \
  preset-normalize.sh \
  preset-hls.sh \
  preset-rtmps.sh \
  generate-synthetic-media.sh \
  generate-fallback.sh \
  backup-ffplayout.sh \
  benchmark-720p30.sh \
  benchmark-profiles.sh; do
  SCRIPT_PATH="${SCRIPT_SRC}/${SCRIPT}"
  if [[ -f "$SCRIPT_PATH" ]]; then
    SCRIPT_NAME=$(basename "$SCRIPT")
    install -m 0755 "$SCRIPT_PATH" "/opt/gsa-tv/scripts/${SCRIPT_NAME}"
    echo "  Copiado: ${SCRIPT_NAME}"
  else
    echo "  Aviso: ${SCRIPT} não encontrado (skip)"
  fi
done

echo ""
echo "[GSA-TV] Copiando configuração de monitoramento..."
INFRA_DIR="$(cd "${SCRIPT_SRC}/.." && pwd)"

for F in prometheus.yml; do
  if [[ -f "${INFRA_DIR}/monitoring/${F}" ]]; then
    cp "${INFRA_DIR}/monitoring/${F}" /opt/gsa-tv/monitoring/
    echo "  Copiado: ${F}"
  fi
done

if [[ -d "${INFRA_DIR}/monitoring/rules" ]]; then
  cp -r "${INFRA_DIR}/monitoring/rules/." /opt/gsa-tv/monitoring/rules/
  echo "  Copiadas: rules/*.yml"
fi

echo ""
echo "[GSA-TV] Verificando permissões dos secrets..."
[[ -d /opt/gsa-tv/secrets ]] && chmod 700 /opt/gsa-tv/secrets
for SECRET_FILE in /opt/gsa-tv/secrets/*; do
  [[ -f "$SECRET_FILE" ]] && chmod 600 "$SECRET_FILE"
done

echo ""
echo "[GSA-TV] Árvore de diretórios:"
find /opt/gsa-tv -maxdepth 3 -type d | sort

echo ""
echo "[GSA-TV] setup-directories.sh concluído."
echo "  Próximo passo: docker compose -f compose.yml up -d --build"
