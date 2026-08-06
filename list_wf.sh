sudo docker exec n8n-db psql -U n8n -d n8n -c "SELECT id, name FROM workflow_entity;"
