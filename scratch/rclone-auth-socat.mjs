import { runSshScript } from 'file:///c:/Users/Adriano%20Farias/Downloads/remix-9.10_-grupo-gsa---gest%C3%A3o-de-servi%C3%A7os%20-%20Copia%20(4)/scratch/ssh2-run.mjs';

async function main() {
  // rclone is already running and listening on host's 127.0.0.1:53682
  // But it only binds to 127.0.0.1, not 0.0.0.0
  // So we need to:
  // 1. Make it accessible from the container network, OR
  // 2. Use socat on the host to forward 0.0.0.0:53682 to 127.0.0.1:53682
  //    (but that conflicts since rclone is already on :53682)
  //    Instead, forward on a different port
  // 3. Or use socat INSIDE the container to forward to host

  const script = `
# rclone is running on host 127.0.0.1:53682 - verify
ss -tlnp | grep 53682 && echo "rclone listening OK" || { echo "rclone NOT listening - restarting"; pkill -f "rclone authorize"; sleep 1; nohup rclone authorize "drive" --auth-no-open-browser > /tmp/rclone-auth-output.txt 2>&1 & sleep 3; }

# Use socat on HOST to also listen on 0.0.0.0:53683 and forward to 127.0.0.1:53682
pkill -f "socat.*53683" 2>/dev/null || true
sleep 0.5
nohup socat TCP-LISTEN:53683,fork,reuseaddr,bind=0.0.0.0 TCP:127.0.0.1:53682 > /tmp/socat-proxy.log 2>&1 &
SOCAT_PID=$!
echo "socat proxy PID=$SOCAT_PID"
sleep 1

# Verify socat is listening
ss -tlnp | grep 53683 && echo "socat proxy listening OK" || echo "socat proxy FAILED"

# Now use socat INSIDE the browser container to forward 127.0.0.1:53682 -> host:53683
docker exec gsa-ai-browser sh -c 'pkill -f "socat.*53682" 2>/dev/null; sleep 0.5; nohup socat TCP-LISTEN:53682,fork,reuseaddr,bind=127.0.0.1 TCP:172.21.0.1:53683 > /dev/null 2>&1 & sleep 1; ss -tlnp 2>/dev/null | grep 53682 && echo "container proxy OK" || echo "container proxy FAILED"'

echo ""
echo "=== CURRENT AUTH STATE ==="
cat /tmp/rclone-auth-output.txt | tail -5

# Extract the state parameter
STATE=$(grep -oP 'state=\\K[^\\s]+' /tmp/rclone-auth-output.txt | tail -1)
echo "STATE=$STATE"
`;

  const res = await runSshScript(script, 15000);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
}

main().catch(console.error);
