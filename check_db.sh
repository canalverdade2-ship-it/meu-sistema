sudo docker exec -i evo-postgres psql -U evo -d n8n -c "SELECT id, status, startedAt, stoppedAt FROM execution_entity ORDER BY id DESC LIMIT 10;"
