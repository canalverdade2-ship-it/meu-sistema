import fs from 'fs';
import path from 'path';
import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const localAppJs = path.join(process.cwd(), 'infrastructure/gsa-tv/services/playout-api/src/app.js');
  const content = fs.readFileSync(localAppJs, 'utf8');
  const b64 = Buffer.from(content, 'utf8').toString('base64');

  console.log('Enviando app.js atualizado para a VPS...');
  const remoteTmp = '/tmp/app.js.new.b64';
  
  // Script para gravar o base64, decodificar, validar sintaxe no container e reiniciar
  const script = `
cat << 'EOF' > ${remoteTmp}
${b64}
EOF

base64 -d ${remoteTmp} > /tmp/app.js.new
rm -f ${remoteTmp}

echo "Validando tamanho do novo app.js:"
wc -l /tmp/app.js.new

echo "Backup do arquivo atual no container:"
sudo docker cp gsa-tv-control-plane:/app/src/app.js /tmp/app.js.bak-$(date +%Y%m%d%H%M%S)

echo "Copiando novo app.js para o container:"
sudo docker cp /tmp/app.js.new gsa-tv-control-plane:/app/src/app.js

echo "Testando sintaxe do JavaScript dentro do container:"
sudo docker exec gsa-tv-control-plane node -c /app/src/app.js

echo "Reiniciando container gsa-tv-control-plane..."
sudo docker restart gsa-tv-control-plane

sleep 3
echo "Logs recentes do gsa-tv-control-plane:"
sudo docker logs --tail 25 gsa-tv-control-plane
`;

  const res = await runSshScript(script);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
}

main().catch(console.error);
