#!/bin/bash
set -euo pipefail

WORKER_TOKEN_FILE="/home/opc/.gsa_appeal_worker_token"
if [ ! -s "$WORKER_TOKEN_FILE" ]; then
  umask 077
  openssl rand -hex 32 > "$WORKER_TOKEN_FILE"
fi
APPEAL_WORKER_TOKEN="$(tr -d '\r\n' < "$WORKER_TOKEN_FILE")"

ADS_CRON_SECRET_FILE="/home/opc/.gsa_ads_cron_secret"
ADVERTISING_CRON_SECRET="$(tr -d '\r\n' < "$ADS_CRON_SECRET_FILE")"

GSA_TV_SECRET_FILE="/home/opc/.gsa_tv_secret_key"
GSA_TV_SECRET_KEY="$(tr -d '\r\n' < "$GSA_TV_SECRET_FILE")"

docker rm -f gsa-auth-session 2>/dev/null || true
docker run -d --name gsa-auth-session --restart always -p 9000:8000 \
  -e SUPABASE_URL=https://api.147-15-43-141.nip.io \
  -e SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzczOTU2NDA5LCJleHAiOjIwODk1MzI0MDl9.05kQchOXKH2S062F8SJsb-bmnh3pni-RJE1P0jo0Igs" \
  -e SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzM5NTY0MDksImV4cCI6MjA4OTUzMjQwOX0.-S-q6Omuc1OXHrYlMonGD8a7ZYIGs3zxaOLYiUgWBrw" \
  -e INFINITEPAY_HANDLE="getsemani-gsa" \
  -e PUBLIC_SITE_URL="http://localhost:3000" \
  -e EVOLUTION_API_URL="http://172.17.0.1:8080" \
  -e EVOLUTION_API_KEY="gsa_hub_evolution_token_2026" \
  -e APPEAL_WORKER_TOKEN="$APPEAL_WORKER_TOKEN" \
  -e ADVERTISING_CRON_SECRET="$ADVERTISING_CRON_SECRET" \
  -e GSA_TV_SECRET_KEY="$GSA_TV_SECRET_KEY" \
  -v /home/opc/router.ts:/app/index.ts \
  -v /home/opc/gsa-auth-session.ts:/app/gsa-auth-session.ts \
  -v /home/opc/gsa-payments.ts:/app/gsa-payments.ts \
  -v /home/opc/gsa-ads-public.ts:/app/gsa-ads-public.ts \
  -v /home/opc/gsa-ads-admin.ts:/app/gsa-ads-admin.ts \
  denoland/deno:alpine run --allow-net --allow-env /app/index.ts
