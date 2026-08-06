curl -i -X POST http://localhost:8080/webhook/set/GSA_WhatsApp \
  -H "apikey: gsa_hub_evolution_token_2026" \
  -H "Content-Type: application/json" \
  -d '{
    "webhook": {
      "enabled": true,
      "url": "http://n8n:5678/webhook/evolution-api",
      "byEvents": false,
      "events": ["MESSAGES_UPSERT"]
    }
  }'
