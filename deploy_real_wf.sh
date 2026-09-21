sudo docker exec -e PGPASSWORD='evopass' evo-postgres psql -U evo -d n8n -c "DELETE FROM workflow_entity WHERE id = 'AAAABBBBCCCCDDDD';"
sudo docker cp /tmp/real_scraping_wf.json n8n:/tmp/real_scraping_wf.json
sudo docker exec n8n n8n import:workflow --input=/tmp/real_scraping_wf.json
cat << 'EOF' | sudo docker exec -i -e PGPASSWORD='evopass' evo-postgres psql -U evo -d n8n
UPDATE workflow_entity SET "activeVersionId" = "versionId", active = true WHERE id = 'AAAABBBBCCCCDDDD';
INSERT INTO webhook_entity ("webhookPath", method, node, "webhookId", "pathLength", "workflowId") 
VALUES ('gsa-produtos-scraping', 'POST', 'Webhook Scraping', 'gsa-produtos-scraping', 1, 'AAAABBBBCCCCDDDD') 
ON CONFLICT DO NOTHING;
EOF
sudo docker restart n8n