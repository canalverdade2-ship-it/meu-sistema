import fs from 'fs';
import { runSshScript } from './ssh2-run.mjs';

async function deployAiWorker() {
  const localWorkerCode = fs.readFileSync('scratch/ai_worker.mjs', 'utf8');

  console.log('Deploying ai_worker.mjs to VPS...');

  // Escape backticks and dollars for heredoc
  const script = `
cat << 'EOF' > /opt/gsa-tv/ai-worker/ai_worker.mjs
${localWorkerCode}
EOF

# Cria a pasta de saida caso nao exista
sudo mkdir -p /opt/gsa-tv/cache/media/1/news/ai-studio-production
sudo chmod -R 777 /opt/gsa-tv/cache/media/1/news/ai-studio-production

# Cria o servico systemd para manter o worker rodando 24/7
sudo tee /etc/systemd/system/gsa-ai-producer.service > /dev/null << 'SERVICE'
[Unit]
Description=GSA TV Autonomous AI Production Worker
After=network.target

[Service]
Type=simple
User=opc
WorkingDirectory=/opt/gsa-tv/ai-worker
ExecStart=/usr/bin/node /opt/gsa-tv/ai-worker/ai_worker.mjs
Restart=always
RestartSec=5
Environment=DATABASE_URL=postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub

[Install]
WantedBy=multi-user.target
SERVICE

# Recarrega o systemd, habilita e inicia o servico
sudo systemctl daemon-reload
sudo systemctl enable gsa-ai-producer.service
sudo systemctl restart gsa-ai-producer.service
sleep 2
sudo systemctl status gsa-ai-producer.service --no-pager
`;

  const res = await runSshScript(script);
  console.log('OUTPUT:\n', res.stdout, res.stderr);
}

deployAiWorker().catch(console.error);
