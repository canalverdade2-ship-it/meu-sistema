import { runSshScript } from 'file:///c:/Users/Adriano%20Farias/Downloads/remix-9.10_-grupo-gsa---gest%C3%A3o-de-servi%C3%A7os%20-%20Copia%20(4)/scratch/ssh2-run.mjs';

async function main() {
  // The container socat is working (listening on 127.0.0.1:53682 inside container)
  // But the host socat on port 53683 is NOT working
  // Let me fix the host-side proxy
  
  console.log('=== Fix host proxy ===');
  const r1 = await runSshScript(`
# Kill old socat attempts
sudo pkill -f "socat.*53683" 2>/dev/null || true
sleep 0.5

# Check if port 53683 is free
ss -tlnp | grep 53683 || echo "53683 is free"

# Try without sudo
nohup socat TCP-LISTEN:53683,fork,reuseaddr TCP:127.0.0.1:53682 > /tmp/socat-host.log 2>&1 &
SOCAT_PID=$!
echo "socat PID=$SOCAT_PID"
sleep 1

# Check
ss -tlnp | grep 53683
echo "---"
ps aux | grep socat | grep -v grep
echo "---"
cat /tmp/socat-host.log
`, 10000);
  console.log(r1.stdout);
  if (r1.stderr) console.error('STDERR:', r1.stderr);
  
  // Now test the full chain from browser container
  console.log('\n=== Test full chain ===');
  const r2 = await runSshScript(`
# Test from container using wget (curl not available)
docker exec gsa-ai-browser wget -q -O - http://127.0.0.1:53682/ 2>&1 | head -5 || echo "wget test done"
# Or use node inside container
docker exec gsa-ai-browser node -e "
const http = require('http');
http.get('http://127.0.0.1:53682/', (res) => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', JSON.stringify(res.headers));
  res.on('data', () => {});
}).on('error', (e) => console.log('Error:', e.message));
" 2>&1
`, 10000);
  console.log(r2.stdout);
  if (r2.stderr) console.error('STDERR:', r2.stderr);
}

main().catch(console.error);
