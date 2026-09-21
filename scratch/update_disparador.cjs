const fs = require('fs');
let data = JSON.parse(fs.readFileSync('scratch/n8n_workflows_fixed2.json', 'utf8'));

let modified = false;
data.forEach(workflow => {
  if (workflow.name === 'GSA System - Disparador WhatsApp (Evolution API)') {
    const textNode = workflow.nodes.find(n => n.name === 'Enviar Somente Texto');
    if (textNode) {
      if (!textNode.parameters.bodyParameters.parameters.find(p => p.name === 'delay')) {
        textNode.parameters.bodyParameters.parameters.push({name: 'delay', value: '4000'}, {name: 'presence', value: 'composing'});
        modified = true;
      }
    }
  }
});

if (modified) {
    fs.writeFileSync('scratch/n8n_workflows_fixed3.json', JSON.stringify(data, null, 2), 'utf8');
    console.log('Disparador WhatsApp modificado.');
} else {
    console.log('Nao foi necessario modificar.');
}
