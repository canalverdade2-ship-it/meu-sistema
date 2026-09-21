import { runSshScript } from './ssh2-run.mjs';

const restartScript = `
echo "=== 1. Restarting gsa-program-builder.service ==="
sudo systemctl restart gsa-program-builder.service
sleep 2

echo "=== 2. Checking systemctl status ==="
sudo systemctl status gsa-program-builder.service --no-pager

echo "=== 3. Testing HTTP health endpoint ==="
curl -s http://127.0.0.1:8770/health

echo ""
echo "=== 4. Testing HTTP /programs endpoint ==="
curl -s http://127.0.0.1:8770/programs

echo ""
echo "=== 5. Testing HTTP /validate endpoint with GSA Agro ==="
curl -s -X POST http://127.0.0.1:8770/validate \\
  -H "Content-Type: application/json" \\
  -d '{"programa":"GSA Agro","slug":"gsa-agro","timeline":[{"tipo":"presenting"},{"tipo":"return"}]}'

echo ""
`;

async function main() {
  const r = await runSshScript(restartScript, 30000);
  console.log('STDOUT:\n' + r.stdout);
  console.log('STDERR:\n' + r.stderr);
}

main().catch(console.error);
