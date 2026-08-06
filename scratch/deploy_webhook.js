const { execSync } = require('child_process');
const fs = require('fs');

const SSH_KEY = 'C:\\Users\\Adriano Farias\\Downloads\\CLOUD\\ssh-key-2026-07-30.key';
const SERVER = 'opc@163.176.97.152';

try {
  const code = fs.readFileSync('scratch/server_webhook.js', 'utf8');
  const b64 = Buffer.from(code).toString('base64');
  
  console.log('Sending script to server...');
  const remoteCmd = `echo "${b64}" | base64 -d > /tmp/server_webhook.js && pkill -f server_webhook.js 2>/dev/null || true`;
  execSync(`ssh -o StrictHostKeyChecking=no -i "${SSH_KEY}" ${SERVER} "${remoteCmd}"`, { stdio: 'inherit' });

  console.log('Starting Webhook Server...');
  execSync(`ssh -o StrictHostKeyChecking=no -i "${SSH_KEY}" ${SERVER} "nohup node /tmp/server_webhook.js > /tmp/webhook.log 2>&1 &"`, { stdio: 'inherit' });

  console.log('Restarting Cloudflare Tunnel on port 5679...');
  execSync(`ssh -o StrictHostKeyChecking=no -i "${SSH_KEY}" ${SERVER} "pkill cloudflared 2>/dev/null || true"`, { stdio: 'inherit' });
  execSync(`ssh -o StrictHostKeyChecking=no -i "${SSH_KEY}" ${SERVER} "nohup /tmp/cloudflared tunnel --url http://localhost:5679 --no-autoupdate > /tmp/cloudflared.log 2>&1 &"`, { stdio: 'inherit' });

  console.log('Waiting for Tunnel HTTPS URL...');
  execSync('node -e "setTimeout(() => {}, 8000)"');

  const tunnelOutput = execSync(`ssh -o StrictHostKeyChecking=no -i "${SSH_KEY}" ${SERVER} "grep -ao 'https://[a-z0-9-]*\\.trycloudflare\\.com' /tmp/cloudflared.log | tail -1"`).toString().trim();

  console.log('\n=============================================');
  console.log('TUNNEL_URL:', tunnelOutput);
  console.log('=============================================\n');
} catch (e) {
  console.error('Error during deployment:', e.message);
}
