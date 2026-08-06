sudo docker run -d \
  --name evolution-api \
  --network evo-net \
  -p 8080:8080 \
  -e SERVER_URL=http://163.176.97.152:8080 \
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
  evoapicloud/evolution-api:latest
