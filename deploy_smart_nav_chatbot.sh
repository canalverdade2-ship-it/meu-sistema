sudo docker cp /tmp/server_webhook.cjs n8n:/tmp/server_webhook.cjs
sudo docker exec n8n pkill -f server_webhook.cjs || true
sudo docker exec -d n8n sh -c 'node /tmp/server_webhook.cjs > /tmp/chatbot_live.log 2>&1'

sleep 2
sudo docker exec n8n cat /tmp/chatbot_live.log
