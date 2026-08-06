sudo docker exec n8n curl -i -X POST http://localhost:5680/webhook -H "Content-Type: application/json" -d '{
  "event": "messages.upsert",
  "instance": "GSA_WhatsApp",
  "data": {
    "key": {
      "remoteJid": "5511920857756@s.whatsapp.net",
      "fromMe": false,
      "id": "TEST_FULL_BOT"
    },
    "message": {
      "conversation": "Oi"
    }
  }
}'
