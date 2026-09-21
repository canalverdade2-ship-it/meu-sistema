import { runSshScript } from 'file:///c:/Users/Adriano%20Farias/Downloads/remix-9.10_-grupo-gsa---gest%C3%A3o-de-servi%C3%A7os%20-%20Copia%20(4)/scratch/ssh2-run.mjs';

async function main() {
  // Step 1: Kill everything and restart clean
  console.log('=== STEP 1: Clean restart ===');
  try {
    await runSshScript(`
pkill -f "rclone authorize" 2>/dev/null || true
pkill -f "socat.*53682" 2>/dev/null || true  
pkill -f "socat.*53683" 2>/dev/null || true
sudo pkill -f "socat.*53683" 2>/dev/null || true
docker exec gsa-ai-browser sh -c 'pkill -f socat 2>/dev/null' || true
sleep 1
echo "Clean done"
`, 10000);
  } catch (e) { console.log('Clean:', e.message); }
  
  // Step 2: Start rclone authorize
  console.log('=== STEP 2: Start rclone ===');
  const r2 = await runSshScript(`
nohup rclone authorize "drive" --auth-no-open-browser > /tmp/rclone-auth-output.txt 2>&1 &
sleep 3
cat /tmp/rclone-auth-output.txt
`, 10000);
  console.log(r2.stdout);
  
  // Step 3: Set up host-side proxy (sudo socat in background)
  console.log('=== STEP 3: Host socat proxy ===');
  const r3 = await runSshScript(`
sudo nohup socat TCP-LISTEN:53683,fork,reuseaddr,bind=0.0.0.0 TCP:127.0.0.1:53682 > /tmp/socat-host.log 2>&1 &
sleep 1
ss -tlnp | grep -E "53682|53683"
echo "---"
curl -s -o /dev/null -w '%{http_code}' http://0.0.0.0:53683/auth?state=test 2>/dev/null || echo "Host proxy test failed"
`, 10000);
  console.log(r3.stdout);
  
  // Step 4: Set up container-side proxy
  console.log('=== STEP 4: Container socat proxy ===');
  const r4 = await runSshScript(`
docker exec -d gsa-ai-browser socat TCP-LISTEN:53682,fork,reuseaddr,bind=127.0.0.1 TCP:172.21.0.1:53683
sleep 2
docker exec gsa-ai-browser sh -c 'ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null' | grep 53682
echo "---container proxy check---"
`, 10000);
  console.log(r4.stdout);
  
  // Step 5: Test end-to-end from container
  console.log('=== STEP 5: Test from container ===');
  const r5 = await runSshScript(`
docker exec gsa-ai-browser curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:53682/ 2>/dev/null || echo "E2E test failed"
echo ""
cat /tmp/rclone-auth-output.txt | tail -5
`, 10000);
  console.log(r5.stdout);
}

main().catch(console.error);
