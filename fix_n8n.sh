sudo docker exec n8n n8n export:workflow --id=axrrRfvSTGkcFvXo --output=/tmp/wf.json
sudo docker exec n8n sed -i 's/http:\/\/163.176.97.152:8080/http:\/\/evolution-api:8080/g' /tmp/wf.json
sudo docker exec n8n n8n import:workflow --input=/tmp/wf.json
sudo docker exec n8n n8n publish:workflow --id=axrrRfvSTGkcFvXo
sudo docker restart n8n
