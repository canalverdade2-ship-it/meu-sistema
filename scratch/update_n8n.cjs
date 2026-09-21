const fs = require('fs');
let data = JSON.parse(fs.readFileSync('scratch/n8n_workflows_fixed.json', 'utf8'));

data.forEach(workflow => {
  if (workflow.name === 'Bot GSA - Evolution API') {
    const waitNode = {
      "parameters": {
        "amount": 3,
        "unit": "seconds"
      },
      "id": "wait-human-reaction-1",
      "name": "Tempo de Leitura",
      "type": "n8n-nodes-base.wait",
      "typeVersion": 1,
      "position": [ 200, 0 ]
    };

    workflow.nodes.push(waitNode);

    const responder = workflow.nodes.find(n => n.name === 'Responder Cliente');
    if (responder) {
        responder.position = [450, 0];
    }

    workflow.connections = {
      "Receber Mensagem (Webhook)": {
        "main": [
          [
            {
              "node": "Tempo de Leitura",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "Tempo de Leitura": {
        "main": [
          [
            {
              "node": "Responder Cliente",
              "type": "main",
              "index": 0
            }
          ]
        ]
      }
    };
    
    console.log('Workflow atualizado com Tempo de Leitura (Wait Node).');
  }
});

fs.writeFileSync('scratch/n8n_workflows_fixed2.json', JSON.stringify(data, null, 2), 'utf8');
