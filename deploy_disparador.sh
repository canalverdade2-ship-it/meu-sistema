sudo docker cp /tmp/whatsapp_workflow_evolution.json n8n:/tmp/whatsapp_workflow_evolution.json
sudo docker exec n8n n8n import:workflow --input=/tmp/whatsapp_workflow_evolution.json
sudo docker exec n8n n8n publish:workflow --id=gsaDisparadorEvo01
sudo docker restart n8n
