cat << 'EOF' | sudo docker exec -i -e PGPASSWORD='evopass' evo-postgres psql -U evo -d n8n
INSERT INTO webhook_entity ("webhookPath", method, node, "webhookId", "pathLength", "workflowId") 
VALUES ('gsa-produtos-scraping', 'POST', 'Webhook Scraping', 'gsa-produtos-scraping', 1, 'AAAABBBBCCCCDDDD') 
ON CONFLICT DO NOTHING;
EOF
sudo docker restart n8n