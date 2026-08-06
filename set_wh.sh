curl -s -X POST http://localhost:8080/webhook/set/GSA_WhatsApp \
  -H 'Content-Type: application/json' \
  -H 'apikey: gsa_hub_evolution_token_2026' \
  -d '{
    "webhook": {
      "enabled": true,
      "url": "http://163.176.97.152:5678/webhook/evolution-api",
      "byEvents": false,
      "base64": false,
      "events": ["MESSAGES_UPSERT"]
    }
  }'
