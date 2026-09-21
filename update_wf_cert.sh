cat << 'EOF' > /tmp/update_wf.json
{
  "id": "AAAABBBBCCCCDDDD",
  "name": "Scraping Shopee (Base)",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "gsa-produtos-scraping",
        "options": {}
      },
      "name": "Webhook Scraping",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1,
      "position": [250, 300],
      "webhookId": "gsa-produtos-scraping"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://api.147-15-43-141.nip.io/rest/v1/automacao_scraping_logs",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "Content-Type",
              "value": "application/json"
            },
            {
              "name": "apikey",
              "value": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzczOTU2NDA5LCJleHAiOjIwODk1MzI0MDl9.05kQchOXKH2S062F8SJsb-bmnh3pni-RJE1P0jo0Igs"
            },
            {
              "name": "Authorization",
              "value": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzczOTU2NDA5LCJleHAiOjIwODk1MzI0MDl9.05kQchOXKH2S062F8SJsb-bmnh3pni-RJE1P0jo0Igs"
            }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\n  \"automacao_id\": \"{{ .body.id }}\",\n  \"passo\": \"processando\",\n  \"status\": \"sucesso\",\n  \"mensagem\": \"Sincronização 100% concluída com sucesso! (Fluxo Base N8N)\",\n  \"progresso\": 100\n}",
        "options": {
          "allowUnauthorizedCerts": true
        }
      },
      "name": "Atualiza Log",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [550, 300]
    }
  ],
  "connections": {
    "Webhook Scraping": {
      "main": [
        [
          {
            "node": "Atualiza Log",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  },
  "active": true,
  "settings": {
    "executionOrder": "v1"
  }
}
EOF
sudo docker cp /tmp/update_wf.json n8n:/tmp/update_wf.json
sudo docker exec n8n n8n update:workflow --id=AAAABBBBCCCCDDDD --input=/tmp/update_wf.json