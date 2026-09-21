import { runSshScript } from 'file:///c:/Users/Adriano%20Farias/Downloads/remix-9.10_-grupo-gsa---gest%C3%A3o-de-servi%C3%A7os%20-%20Copia%20(4)/scratch/ssh2-run.mjs';

async function main() {
  const script = `
echo "=== BROWSER CONTAINER NETWORK ==="
docker inspect gsa-ai-browser --format '{{.HostConfig.NetworkMode}}' 2>/dev/null
docker inspect gsa-ai-browser --format '{{range .NetworkSettings.Networks}}Gateway: {{.Gateway}}, IP: {{.IPAddress}}{{end}}' 2>/dev/null

echo ""
echo "=== HOST IP ==="
hostname -I

echo ""
echo "=== RCLONE STILL RUNNING? ==="
pgrep -f "rclone authorize" && echo "YES" || echo "NO"

echo ""
echo "=== KILL RCLONE AUTHORIZE ==="
pkill -f "rclone authorize" 2>/dev/null
echo "Killed"

echo ""
echo "=== ALTERNATIVE: Use rclone with manual token ==="
echo "We can configure rclone non-interactively by creating the config file directly"
echo "But we need an OAuth token first."
echo ""
echo "=== CHECK DOCKER HOST ==="
docker inspect gsa-ai-browser --format '{{json .HostConfig.ExtraHosts}}' 2>/dev/null
`;

  const res = await runSshScript(script, 15000);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
}

main().catch(console.error);
