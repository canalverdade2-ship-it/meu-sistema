import fs from 'fs';
import path from 'path';
import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const localAppJs = path.join(process.cwd(), 'infrastructure/gsa-tv/services/playout-api/src/app.js');
  const content = fs.readFileSync(localAppJs, 'utf8');
  const b64 = Buffer.from(content, 'utf8').toString('base64');

  console.log('Enviando app.js para /opt/gsa-tv/control-plane/src/app.js...');
  const remoteTmp = '/tmp/app.js.b64';
  
  const script = `
cat << 'EOF' > ${remoteTmp}
${b64}
EOF

base64 -d ${remoteTmp} > /tmp/app.js.new
rm -f ${remoteTmp}

# Backup
sudo cp /opt/gsa-tv/control-plane/src/app.js /opt/gsa-tv/control-plane/src/app.js.bak-$(date +%Y%m%d%H%M%S)

# Atualizar fonte
sudo cp /tmp/app.js.new /opt/gsa-tv/control-plane/src/app.js
sudo chown root:root /opt/gsa-tv/control-plane/src/app.js
sudo chmod 644 /opt/gsa-tv/control-plane/src/app.js
rm -f /tmp/app.js.new

echo "Validando sintaxe localmente com node:"
node -c /opt/gsa-tv/control-plane/src/app.js

echo "Recompilando imagem do control-plane..."
cd /opt/gsa-tv/control-plane
sudo docker compose build
sudo docker compose up -d

sleep 3
echo "Status do container:"
sudo docker ps --filter "name=gsa-tv-control-plane" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
sudo docker logs --tail 25 gsa-tv-control-plane
`;

  const res = await runSshScript(script);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
}

main().catch(console.error);
