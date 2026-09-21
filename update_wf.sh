cat << 'EOF' | sudo docker exec -i -e PGPASSWORD='evopass' evo-postgres psql -U evo -d n8n
UPDATE workflow_entity SET "activeVersionId" = "versionId" WHERE id = 'AAAABBBBCCCCDDDD';
EOF
sudo docker restart n8n