sudo docker cp /tmp/server_webhook.cjs n8n:/tmp/server_webhook.cjs
sudo docker exec n8n pkill -f server_webhook.cjs || true
sudo docker exec -d n8n node /tmp/server_webhook.cjs

sleep 2

curl -i -X POST http://localhost:8080/webhook/set/GSA_WhatsApp \
  -H "apikey: gsa_hub_evolution_token_2026" \
  -H "Content-Type: application/json" \
  -d '{
    "webhook": {
      "enabled": true,
      "url": "http://n8n:5680/webhook",
      "byEvents": false,
      "events": ["MESSAGES_UPSERT"]
    }
  }'
