sudo docker exec -i evo-postgres psql -U evo -d n8n -c "SELECT data FROM execution_data WHERE \"executionId\" = 75;"
