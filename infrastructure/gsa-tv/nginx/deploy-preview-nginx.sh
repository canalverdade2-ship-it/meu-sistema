#!/usr/bin/env bash
# GSA TV — Instalação e ativação da configuração Nginx de Preview HLS
# Uso: sudo bash deploy-preview-nginx.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NGINX_SRC="${SCRIPT_DIR}/gsa-tv-preview.conf"
NGINX_DEST="/etc/nginx/conf.d/gsa-tv-preview.conf"

echo "========================================================"
echo " GSA TV — Ativação de Preview HLS no Nginx"
echo "========================================================"

if [[ ! -f "$NGINX_SRC" ]]; then
  echo >&2 "ERRO: Arquivo fonte $NGINX_SRC não encontrado."
  exit 1
fi

echo "1. Copiando configuração para $NGINX_DEST..."
cp "$NGINX_SRC" "$NGINX_DEST"

echo "2. Validando sintaxe do Nginx (nginx -t)..."
if nginx -t; then
  echo "3. Sintaxe validada com sucesso! Recarregando Nginx (sem downtime)..."
  systemctl reload nginx || nginx -s reload
  echo ""
  echo "Preview HLS interno ativado com sucesso em:"
  echo "  https://seu-dominio.com/gsa-tv/preview/hls/playlist.m3u8"
else
  echo >&2 "ERRO: Falha na validação de sintaxe do Nginx. Revertendo alteração..."
  rm -f "$NGINX_DEST"
  exit 1
fi
