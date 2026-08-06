sudo docker exec n8n-db psql -U n8n -d n8n -c "SELECT id, status, mode, \"startedAt\", \"stoppedAt\" FROM execution_entity ORDER BY id DESC LIMIT 5;"
