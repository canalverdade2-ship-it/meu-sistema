sudo firewall-cmd --permanent --add-port=5680/tcp
sudo firewall-cmd --reload

pkill -f server_webhook.cjs || true
nohup node /tmp/server_webhook.cjs > /tmp/chatbot.log 2>&1 &

sleep 2

curl -i -X POST http://localhost:8080/webhook/set/GSA_WhatsApp \
  -H "apikey: gsa_hub_evolution_token_2026" \
  -H "Content-Type: application/json" \
  -d '{
    "webhook": {
      "enabled": true,
      "url": "http://163.176.97.152:5680/webhook",
      "byEvents": false,
      "events": ["MESSAGES_UPSERT"]
    }
  }'
