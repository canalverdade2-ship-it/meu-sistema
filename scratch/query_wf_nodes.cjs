const { execSync } = require('child_process');

const SSH_KEY = 'C:\\Users\\Adriano Farias\\Downloads\\CLOUD\\ssh-key-2026-07-30.key';
const SERVER = 'opc@163.176.97.152';

function ssh(cmd) {
  return execSync(`ssh -o StrictHostKeyChecking=no -i "${SSH_KEY}" ${SERVER} "${cmd.replace(/"/g, '\\"')}"`, {
    encoding: 'utf8'
  });
}

try {
  const res = ssh('sudo docker exec -i evo-postgres psql -U evo -d n8n -t -A -c "SELECT json_build_object(\'id\', id, \'name\', name, \'active\', active, \'nodes\', nodes) FROM workflow_entity;"');
  const lines = res.trim().split('\n').filter(Boolean);
  for (const line of lines) {
    const wf = JSON.parse(line);
    console.log(`\n=== WORKFLOW: [${wf.id}] ${wf.name} (active: ${wf.active}) ===`);
    for (const node of (wf.nodes || [])) {
      console.log(`- [${node.type}] "${node.name}" (webhookId: ${node.webhookId || 'none'})`);
      if (node.parameters && node.parameters.path) {
        console.log(`    Webhook Path: ${node.parameters.path}`);
      }
    }
  }
} catch (err) {
  console.error('Error:', err.message);
}
