import { runSshScript } from 'file:///c:/Users/Adriano%20Farias/Downloads/remix-9.10_-grupo-gsa---gest%C3%A3o-de-servi%C3%A7os%20-%20Copia%20(4)/scratch/ssh2-run.mjs';

async function main() {
  // Check if the headless browser container is accessible from VPS
  const script = `
echo "=== DOCKER CONTAINERS ==="
docker ps --format "{{.Names}} {{.Ports}}" 2>/dev/null | grep -i browser || echo "No browser container found"
docker ps --format "{{.Names}} {{.Ports}}" 2>/dev/null

echo ""
echo "=== CHECK CDP ENDPOINT ==="
curl -s http://127.0.0.1:9228/json/version 2>/dev/null | head -10 || echo "CDP endpoint not accessible"

echo ""
echo "=== RCLONE HELP AUTHORIZE ==="
rclone authorize --help 2>&1 | head -15

echo ""
echo "=== CHECK IF WE CAN USE RCLONE CONFIG CREATE ==="
rclone config create --help 2>&1 | head -20
`;

  const res = await runSshScript(script, 30000);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
}

main().catch(console.error);
