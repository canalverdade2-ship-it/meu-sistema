sudo docker exec n8n sqlite3 /home/node/.n8n/database.sqlite "SELECT id, name, active FROM workflow_entity;"
