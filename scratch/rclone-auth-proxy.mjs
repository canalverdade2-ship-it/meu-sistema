import { runSshScript } from 'file:///c:/Users/Adriano%20Farias/Downloads/remix-9.10_-grupo-gsa---gest%C3%A3o-de-servi%C3%A7os%20-%20Copia%20(4)/scratch/ssh2-run.mjs';

/**
 * Strategy: 
 * 1. Start rclone authorize on host binding to 0.0.0.0:53682
 * 2. Use iptables/socat inside the browser container to map 127.0.0.1:53682 -> host:53682
 *    OR navigate the browser to the Google OAuth URL directly, then intercept the redirect
 *    
 * Actually the simplest approach: rclone authorize generates a token. The redirect_uri
 * is always http://127.0.0.1:53682/ and we can't change it. 
 * 
 * New approach: Set up socat inside the browser container to proxy 127.0.0.1:53682 → host
 */
async function main() {
  const script = `
# Kill any existing rclone authorize
pkill -f "rclone authorize" 2>/dev/null || true
sleep 1

# Start rclone authorize in background, bind to all interfaces
nohup rclone authorize "drive" --auth-no-open-browser > /tmp/rclone-auth-output.txt 2>&1 &
RCLONE_PID=$!
echo "RCLONE_PID=$RCLONE_PID"

# Wait for it to start listening
sleep 3

# Verify it's listening
ss -tlnp | grep 53682 || echo "Port 53682 not found in ss output"

# Install socat inside the browser container to proxy 127.0.0.1:53682 -> host
echo ""
echo "=== Setting up port proxy inside browser container ==="
# First check if socat is available in the container
docker exec gsa-ai-browser which socat 2>/dev/null && echo "socat available" || echo "socat NOT available"

# Try using iptables from the host to add a NAT rule  
# Actually, simpler: just use docker exec to start socat
# Or even simpler: start a node.js TCP proxy inside the container

# Let's create a simple TCP proxy in the container
docker exec -d gsa-ai-browser sh -c '
  # Kill any existing proxy
  pkill -f "node.*proxy-53682" 2>/dev/null || true
  
  cat > /tmp/proxy-53682.js << "PROXYEOF"
const net = require("net");
const server = net.createServer((client) => {
  const remote = net.createConnection(53682, "172.21.0.1", () => {
    client.pipe(remote);
    remote.pipe(client);
  });
  remote.on("error", (e) => { console.error("Remote error:", e.message); client.destroy(); });
  client.on("error", (e) => { console.error("Client error:", e.message); remote.destroy(); });
});
server.listen(53682, "127.0.0.1", () => console.log("Proxy listening on 127.0.0.1:53682 -> 172.21.0.1:53682"));
PROXYEOF

  node /tmp/proxy-53682.js &
  sleep 1
  echo "Proxy started"
'

sleep 2

# Verify the proxy is running inside the container
docker exec gsa-ai-browser sh -c 'ss -tlnp 2>/dev/null | grep 53682 || netstat -tlnp 2>/dev/null | grep 53682 || echo "Port not listening in container"'

echo ""
echo "=== RCLONE OUTPUT ==="
cat /tmp/rclone-auth-output.txt
`;

  console.log('Setting up rclone authorize with container proxy...');
  const res = await runSshScript(script, 30000);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
}

main().catch(console.error);
