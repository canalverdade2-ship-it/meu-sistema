sudo docker exec -i evo-postgres psql -U evo -d n8n -c "UPDATE workflow_entity SET nodes = REPLACE(nodes::text, 'http://163.176.97.152:8080', 'http://evolution-api:8080')::jsonb WHERE name LIKE '%Bot GSA%';"
sudo docker restart n8n
