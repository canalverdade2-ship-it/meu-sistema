cat << 'WORKFLOW_EOF' > /tmp/n8n_python_runner_wf.json
{
  "id": "AAAABBBBCCCCDDDD",
  "name": "Scraping Shopee (Real Worker)",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "gsa-produtos-scraping",
        "options": {},
        "responseMode": "onReceived"
      },
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1,
      "position": [250, 300],
      "webhookId": "gsa-produtos-scraping"
    },
    {
      "parameters": {
        "command": "=/usr/bin/python3 /home/opc/worker_shopee_sync.py \"{{ $json.body.id || $json.id }}\""
      },
      "name": "Execute Python Worker",
      "type": "n8n-nodes-base.executeCommand",
      "typeVersion": 1,
      "position": [500, 300]
    }
  ],
  "connections": {
    "Webhook": {
      "main": [
        [
          {
            "node": "Execute Python Worker",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  },
  "active": true,
  "settings": {
    "executionOrder": "v1",
    "saveDataErrorExecution": "all",
    "saveDataSuccessExecution": "all"
  }
}
WORKFLOW_EOF