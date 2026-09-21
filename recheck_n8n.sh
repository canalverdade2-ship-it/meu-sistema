# Garantir que a rota do webhook está no webhook_entity
cat << 'EOF' | sudo docker exec -i -e PGPASSWORD='evopass' evo-postgres psql -U evo -d n8n
UPDATE workflow_entity SET "activeVersionId" = "versionId", active = true WHERE id = 'AAAABBBBCCCCDDDD';
INSERT INTO webhook_entity ("webhookPath", method, node, "webhookId", "pathLength", "workflowId") 
VALUES ('gsa-produtos-scraping', 'POST', 'Webhook', 'gsa-produtos-scraping', 1, 'AAAABBBBCCCCDDDD') 
ON CONFLICT DO NOTHING;
EOF
sudo docker restart n8n
sleep 5