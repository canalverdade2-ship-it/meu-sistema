sudo docker exec -i evo-postgres psql -U evo -d n8n -c "SELECT data->'resultData'->'error' FROM execution_entity WHERE id IN (71, 72);"
