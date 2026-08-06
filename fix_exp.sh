sudo docker exec n8n n8n export:workflow --id=axrrRfvSTGkcFvXo --output=/tmp/wf2.json
sudo docker exec n8n sed -i 's/"value":"?? Ol?/"value":"=?? Ol?/g' /tmp/wf2.json
sudo docker exec n8n n8n import:workflow --input=/tmp/wf2.json
sudo docker exec n8n n8n publish:workflow --id=axrrRfvSTGkcFvXo
sudo docker restart n8n
