import { runSshScript } from 'file:///c:/Users/Adriano%20Farias/Downloads/remix-9.10_-grupo-gsa---gest%C3%A3o-de-servi%C3%A7os%20-%20Copia%20(4)/scratch/ssh2-run.mjs';

/**
 * Use the headless browser container to complete the OAuth flow.
 * The rclone authorize process is listening on 127.0.0.1:53682.
 * We navigate the browser to that URL, which will redirect to Google OAuth,
 * and since the account adriano9865@gmail.com is already logged in,
 * it should complete the flow.
 */
async function main() {
  // First, let's use node on the VPS to connect to the browser via CDP 
  // and navigate to the rclone auth URL
  const script = `
# Use the headless browser to navigate to the rclone auth URL
# The browser container has access to the host network via port mapping
# Let's try using curl to get the initial redirect URL from rclone
echo "=== STEP 1: Get redirect URL from rclone local server ==="
REDIRECT_URL=$(curl -s -L -o /dev/null -w '%{url_effective}' "http://127.0.0.1:53682/auth?state=97zfa5vulZbbVTAikrEoJg" 2>/dev/null || true)
echo "Redirect URL: $REDIRECT_URL"

# Actually, let's get the full redirect chain
echo ""
echo "=== STEP 2: Follow redirects ==="
curl -s -v "http://127.0.0.1:53682/auth?state=97zfa5vulZbbVTAikrEoJg" 2>&1 | grep -i "location:" | head -5

echo ""
echo "=== RCLONE STATUS ==="
cat /tmp/rclone-auth-output.txt
`;

  const res = await runSshScript(script, 15000);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
}

main().catch(console.error);
