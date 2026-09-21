import { runSshScript } from './ssh2-run.mjs';

const script = `
echo "=== COMPOSE FILES ==="
ls -la /opt/gsa-tv/encoder-engine/compose.yml
ls -la /opt/gsa-tv/compose/compose.yml
ls -la /opt/gsa-tv/control-plane/compose.yml
ls -la /opt/gsa-tv/watchdog/compose.yml
ls -la /home/opc/gsa-ai/compose.yml

echo "=== ENCODER ENGINE COMPOSE ==="
cat /opt/gsa-tv/encoder-engine/compose.yml

echo "=== FFPLAYOUT COMPOSE ==="
cat /opt/gsa-tv/compose/compose.yml

echo "=== CONTROL PLANE COMPOSE ==="
cat /opt/gsa-tv/control-plane/compose.yml

echo "=== WATCHDOG COMPOSE ==="
cat /opt/gsa-tv/watchdog/compose.yml

echo "=== GSA-AI COMPOSE ==="
cat /home/opc/gsa-ai/compose.yml
`;

const res = await runSshScript(script);
console.log(res.stdout);
