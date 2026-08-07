#!/bin/bash
# Script de Migração Automatizada da Evolution API & n8n para a Nova VPS 147.15.43.141

echo "🚀 Iniciando restauração e configuração dos serviços na Nova VPS (147.15.43.141)..."

# 1. Criar rede Docker caso não exista
sudo docker network create evo-net 2>/dev/null || true

# 2. Subir container PostgreSQL para o Evolution & n8n se não estiver ativo
if ! sudo docker ps | grep -q "evo-postgres"; then
  echo "📦 Subindo banco de dados PostgreSQL para os containers..."
  sudo docker run -d \
    --name evo-postgres \
    --network evo-net \
    -e POSTGRES_USER=evo \
    -e POSTGRES_PASSWORD=evopass \
    -e POSTGRES_MULTIPLE_DATABASES=evolution,n8n \
    -v evo_postgres_data:/var/lib/postgresql/data \
    -p 5433:5432 \
    --restart always \
    postgres:15-alpine
fi

# 3. Subir Redis para cache do Evolution API
if ! sudo docker ps | grep -q "evo-redis"; then
  echo "⚡ Subindo container Redis..."
  sudo docker run -d \
    --name evo-redis \
    --network evo-net \
    --restart always \
    redis:7-alpine
fi

# 4. Subir Evolution API na porta 8080
if ! sudo docker ps | grep -q "evolution-api"; then
  echo "📱 Subindo container Evolution API..."
  sudo docker run -d \
    --name evolution-api \
    --network evo-net \
    -p 8080:8080 \
    -e SERVER_URL=http://147.15.43.141:8080 \
    -e AUTHENTICATION_API_KEY=gsa_hub_evolution_token_2026 \
    -e DATABASE_PROVIDER=postgresql \
    -e DATABASE_CONNECTION_URI="postgresql://evo:evopass@evo-postgres:5432/evolution?schema=public" \
    -e CACHE_REDIS_ENABLED=true \
    -e CACHE_REDIS_URI="redis://evo-redis:6379" \
    -e CACHE_REDIS_PREFIX_KEY=evo \
    -e CACHE_REDIS_SAVE_INSTANCES=false \
    -e CACHE_REDIS_CLEAN_INSTANCES_ON_START=true \
    -e WEBHOOK_EVENTS_IGNORE_FROM_ME=false \
    -e TZ=America/Sao_Paulo \
    --restart always \
    atendai/evolution-api:latest
fi

echo "✅ Containers ativos com sucesso na VPS (147.15.43.141)!"
