sudo docker exec evolution-api curl -s -X POST "http://localhost:8080/message/sendText/GSA_WhatsApp" \
-H "apikey: gsa_hub_evolution_token_2026" \
-H "Content-Type: application/json" \
-d '{"number": "5511971858372", "text": "?? Teste t?cnico direto do sistema interno."}'
