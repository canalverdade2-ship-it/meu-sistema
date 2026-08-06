sudo docker cp /tmp/server_webhook.cjs n8n:/tmp/server_webhook.cjs
sudo docker exec -d n8n node /tmp/server_webhook.cjs

sleep 2
sudo docker exec n8n ps aux | grep node
