const { execSync } = require('child_process');

const SSH_KEY = 'C:\\Users\\Adriano Farias\\Downloads\\CLOUD\\ssh-key-2026-07-30.key';
const SERVER = 'opc@163.176.97.152';

function ssh(cmd) {
  return execSync(`ssh -o StrictHostKeyChecking=no -i "${SSH_KEY}" ${SERVER} "${cmd}"`, { encoding: 'utf8', stdio: ['pipe','pipe','pipe'] });
}

try {
  // 1. Upload file
  console.log('1. Uploading via scp...');
  execSync(`scp -o StrictHostKeyChecking=no -i "${SSH_KEY}" scratch/server_webhook.cjs ${SERVER}:/tmp/server_webhook_new.cjs`, { stdio: 'inherit' });

  // 2. Copy into container
  console.log('2. Copying into container...');
  ssh('sudo docker cp /tmp/server_webhook_new.cjs n8n:/home/node/server_webhook.cjs');



  // 3. Restart process via PM2 inside container
  console.log('3. Starting/Restarting via PM2 inside container...');
  try { ssh('sudo docker exec n8n pm2 delete gsa-bot'); } catch(e) {}
  ssh('sudo docker exec n8n pm2 start /home/node/server_webhook.cjs --name gsa-bot');
  try { ssh('sudo docker exec n8n pm2 save'); } catch(e) {}

  // 5. Verify process
  console.log('5. Verifying process...');
  execSync('node -e "setTimeout(() => {}, 3000)"');
  const ps = ssh('sudo docker exec n8n ps aux');
  console.log('Processes:\n', ps);

  const logs = ssh('sudo docker exec n8n tail -n 25 /tmp/chatbot_live.log');
  console.log('Live Logs:\n', logs);

} catch(e) {
  console.error('Error:', e.message);
}
