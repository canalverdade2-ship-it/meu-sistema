#!/bin/bash
curl -s -X POST http://127.0.0.1:8080/instance/create \
  -H "apikey: gsa_hub_evolution_token_2026" \
  -H "Content-Type: application/json" \
  -d '{
    "instanceName": "GSA_WhatsApp",
    "token": "gsa_hub_evolution_token_2026",
    "qrcode": false,
    "integration": "WHATSAPP-BAILEYS"
  }'
echo ""
