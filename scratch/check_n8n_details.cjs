const { execSync } = require('child_process');

const SSH_KEY = 'C:\\Users\\Adriano Farias\\Downloads\\CLOUD\\ssh-key-2026-07-30.key';
const SERVER = 'opc@163.176.97.152';

function ssh(cmd) {
  return execSync(`ssh -o StrictHostKeyChecking=no -i "${SSH_KEY}" ${SERVER} "${cmd.replace(/"/g, '\\"')}"`, {
    encoding: 'utf8'
  });
}

try {
  console.log('--- EXPORTING ALL WORKFLOWS ---');
  const workflowsJson = ssh('sudo docker exec n8n n8n export:workflow --all --output=/tmp/all_wf.json && sudo docker exec n8n cat /tmp/all_wf.json');
  const wfs = JSON.parse(workflowsJson);
  for (const wf of wfs) {
    console.log(`Workflow: [${wf.id}] ${wf.name} (active: ${wf.active})`);
    for (const node of (wf.nodes || [])) {
      if (node.type && (node.type.toLowerCase().includes('webhook') || node.type.toLowerCase().includes('trigger'))) {
        console.log(`  - Node: ${node.name} (${node.type})`);
        console.log(`    Parameters:`, JSON.stringify(node.parameters, null, 2));
      }
    }
  }

  console.log('\n--- CHECKING N8N CONTAINER PORT / PROCESSES ---');
  const ports = ssh('sudo docker port n8n');
  console.log('N8N Port mappings:\n', ports);

} catch (err) {
  console.error('Error:', err.message);
}
