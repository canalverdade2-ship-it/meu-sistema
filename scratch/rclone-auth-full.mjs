import { runSshScript } from 'file:///c:/Users/Adriano%20Farias/Downloads/remix-9.10_-grupo-gsa---gest%C3%A3o-de-servi%C3%A7os%20-%20Copia%20(4)/scratch/ssh2-run.mjs';

async function main() {
  // Step 1: Clean up everything
  console.log('=== STEP 1: Clean slate ===');
  await runSshScript(`
pkill -f "rclone authorize" 2>/dev/null || true
pkill -f "node /tmp/tcp-proxy" 2>/dev/null || true
docker exec gsa-ai-browser sh -c 'pkill -f socat 2>/dev/null' || true
sleep 1
echo "Clean"
`, 10000);

  // Step 2: Create Node.js TCP proxy on host and start rclone
  console.log('=== STEP 2: Start rclone + host proxy ===');
  const r2 = await runSshScript(`
# Create a Node.js TCP proxy on host: 0.0.0.0:53683 -> 127.0.0.1:53682
cat > /tmp/tcp-proxy-53683.js << 'EOF'
const net = require("net");
const server = net.createServer((client) => {
  const remote = net.createConnection(53682, "127.0.0.1", () => {
    client.pipe(remote);
    remote.pipe(client);
  });
  remote.on("error", (e) => { client.destroy(); });
  client.on("error", (e) => { remote.destroy(); });
});
server.listen(53683, "0.0.0.0", () => {
  console.log("TCP proxy: 0.0.0.0:53683 -> 127.0.0.1:53682");
});
EOF

# Start rclone authorize
nohup rclone authorize "drive" --auth-no-open-browser > /tmp/rclone-auth-output.txt 2>&1 &
sleep 2

# Start the Node.js TCP proxy
nohup node /tmp/tcp-proxy-53683.js > /tmp/tcp-proxy.log 2>&1 &
sleep 1

# Verify both are running
echo "=== Listeners ==="
ss -tlnp | grep -E "53682|53683"
echo "=== rclone output ==="
cat /tmp/rclone-auth-output.txt
echo "=== proxy log ==="
cat /tmp/tcp-proxy.log
`, 15000);
  console.log(r2.stdout);

  // Step 3: Set up container-side socat
  console.log('=== STEP 3: Container socat ===');
  const r3 = await runSshScript(`
docker exec -d gsa-ai-browser socat TCP-LISTEN:53682,fork,reuseaddr,bind=127.0.0.1 TCP:172.21.0.1:53683
sleep 2
docker exec gsa-ai-browser netstat -tlnp 2>/dev/null | grep 53682 || echo "checking ss..."
docker exec gsa-ai-browser ss -tlnp 2>/dev/null | grep 53682 || echo "no ss either"
# Check with node inside container
docker exec gsa-ai-browser node -e "
const net = require('net');
const c = net.createConnection(53682, '127.0.0.1', () => { console.log('Connected to 53682!'); c.destroy(); });
c.on('error', (e) => console.log('Error:', e.message));
setTimeout(() => process.exit(0), 2000);
"
`, 15000);
  console.log(r3.stdout);

  // Step 4: Now use CDP to navigate browser to the auth URL
  console.log('=== STEP 4: Navigate browser via CDP ===');
  const r4 = await runSshScript(`
# Extract state from rclone output
STATE=$(grep -oP 'state=\\K[^ ]+' /tmp/rclone-auth-output.txt | tail -1)
echo "State: $STATE"

# Get the Google OAuth URL by following the redirect from rclone's local server
# The rclone server at /auth?state=X redirects to Google OAuth
# Let's get the redirect URL
GOOGLE_URL=$(curl -s -o /dev/null -w '%{redirect_url}' "http://127.0.0.1:53682/auth?state=$STATE" 2>/dev/null)
echo "Google OAuth URL: $GOOGLE_URL"
`, 10000);
  console.log(r4.stdout);

  // Extract the Google OAuth URL for the browser
  const googleUrlMatch = r4.stdout.match(/Google OAuth URL: (https:\/\/[^\s]+)/);
  if (!googleUrlMatch) {
    console.log('Could not extract Google OAuth URL');
    // Try getting it from the redirect chain
    const r4b = await runSshScript(`
STATE=$(grep -oP 'state=\\K[^ ]+' /tmp/rclone-auth-output.txt | tail -1)
curl -v "http://127.0.0.1:53682/auth?state=$STATE" 2>&1 | grep -i location
`, 10000);
    console.log(r4b.stdout);
    if (r4b.stderr) console.log(r4b.stderr);
  }
}

main().catch(console.error);
