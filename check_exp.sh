sudo docker exec n8n n8n export:workflow --id=axrrRfvSTGkcFvXo --output=/tmp/check_exp.json
sudo docker exec n8n grep -o '"value":[^,]*' /tmp/check_exp.json
