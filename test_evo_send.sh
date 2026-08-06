curl -i -X POST http://localhost:8080/message/sendText/GSA_WhatsApp \
  -H "apikey: gsa_hub_evolution_token_2026" \
  -H "Content-Type: application/json" \
  -d '{
    "number": "5511920857756@s.whatsapp.net",
    "text": "?? Teste direto da Evolution API!"
  }'
