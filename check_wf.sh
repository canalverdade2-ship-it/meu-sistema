sudo docker exec -i evo-postgres psql -U evo -d n8n -c "SELECT nodes FROM workflow_entity WHERE name = 'Bot GSA - Evolution API';"
