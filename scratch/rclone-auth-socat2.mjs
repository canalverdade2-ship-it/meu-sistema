import { runSshScript } from 'file:///c:/Users/Adriano%20Farias/Downloads/remix-9.10_-grupo-gsa---gest%C3%A3o-de-servi%C3%A7os%20-%20Copia%20(4)/scratch/ssh2-run.mjs';

async function main() {
  const script = `
# Check socat availability on host
which socat 2>/dev/null && echo "Host socat: YES" || echo "Host socat: NO"

# Check if socat failed due to perms
sudo socat TCP-LISTEN:53683,fork,reuseaddr,bind=0.0.0.0 TCP:127.0.0.1:53682 &
SOCAT_PID=$!
sleep 1
ss -tlnp | grep 53683

# Check container socat - run interactively
docker exec gsa-ai-browser socat TCP-LISTEN:53682,fork,reuseaddr,bind=127.0.0.1 TCP:172.21.0.1:53683 &
sleep 2
docker exec gsa-ai-browser ss -tlnp 2>/dev/null | grep 53682
docker exec gsa-ai-browser netstat -tlnp 2>/dev/null | grep 53682

# Test the proxy chain
docker exec gsa-ai-browser curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:53682/ 2>/dev/null || echo "proxy test failed"
`;

  const res = await runSshScript(script, 20000);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
}

main().catch(console.error);
