'use strict';
const { execSync } = require('child_process');

const SSH_KEY = 'C:\\Users\\Adriano Farias\\Downloads\\CLOUD\\ssh-key-2026-07-30.key';
const SERVER = 'opc@147.15.43.141';

function ssh(cmd) {
  return execSync(`ssh -o StrictHostKeyChecking=no -i "${SSH_KEY}" ${SERVER} "${cmd}"`, { encoding: 'utf8' });
}

console.log('🚀 Iniciando deploy do Chatbot atualizado na VPS (147.15.43.141)...');

// 1. Upload file via SCP
console.log('📦 1. Enviando server_webhook_final.cjs via SCP...');
execSync(`scp -o StrictHostKeyChecking=no -i "${SSH_KEY}" scratch/server_webhook_final.cjs ${SERVER}:/home/opc/server_webhook.cjs`, { stdio: 'inherit' });

// 2. Adjust permissions and kill old process
console.log('🛑 2. Ajustando permissões e encerrando instâncias antigas...');
ssh('sudo pkill -9 -f server_webhook.cjs || true; sleep 1');

// 3. Restart systemd service
console.log('🔄 3. Reiniciando serviço gsa-webhook via systemd...');
ssh('sudo systemctl daemon-reload; sudo systemctl restart gsa-webhook; sleep 2');

// 4. Verify systemd status
console.log('📋 4. Verificando status do serviço...');
const status = ssh('sudo systemctl status gsa-webhook --no-pager || true');
console.log(status);

// 5. Test health check
console.log('📡 5. Testando endpoint de health...');
const health = ssh('curl -s http://localhost:5680/health');
console.log('Health response:', health);

// 6. Test Evolution API webhook registration
console.log('🔗 6. Verificando Webhook na Evolution API...');
const evoWebhook = ssh("curl -s http://localhost:8080/webhook/find/GSA_WhatsApp -H 'apikey: gsa_hub_evolution_token_2026'");
console.log('Evolution Webhook:', evoWebhook);

console.log('✅ Deploy finalizado com sucesso!');
