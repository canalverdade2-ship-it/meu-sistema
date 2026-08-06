curl -i -X POST http://localhost:5678/webhook/evolution-api -H "Content-Type: application/json" -d '{
  "event": "messages.upsert",
  "instance": "GSA_WhatsApp",
  "data": {
    "key": {
      "remoteJid": "5511920857756@s.whatsapp.net",
      "fromMe": false,
      "id": "TEST1234"
    },
    "message": {
      "conversation": "Teste de resposta"
    }
  }
}'
