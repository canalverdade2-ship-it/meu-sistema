import { runSshScript } from 'file:///c:/Users/Adriano%20Farias/Downloads/remix-9.10_-grupo-gsa---gest%C3%A3o-de-servi%C3%A7os%20-%20Copia%20(4)/scratch/ssh2-run.mjs';

/**
 * The ws module on VPS has issues. Let's use a simpler approach:
 * Use puppeteer-core or plain HTTP to interact with CDP.
 * 
 * Actually, the simplest approach: use node's built-in http + 
 * the ws package that was installed in /tmp/node_modules.
 * The ECONNRESET might be because of the websocket URL format.
 * 
 * Let me try using the CDP HTTP endpoints instead (they work for simple operations)
 * and use the Page.navigate via the /json/new endpoint.
 */
async function main() {
  // Use CDP HTTP API to create a new page and navigate it
  // The /json/new?url=... endpoint creates a new tab and navigates to the URL
  const googleOAuthUrl = 'https://accounts.google.com/o/oauth2/auth?access_type=offline&client_id=202264815644.apps.googleusercontent.com&redirect_uri=http%3A%2F%2F127.0.0.1%3A53682%2F&response_type=code&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive&state=pEhibMVqMPIwpTf081-k3A';
  
  const encodedUrl = encodeURIComponent(googleOAuthUrl);
  
  const script = `
# Check rclone is still running
pgrep -f "rclone authorize" && echo "rclone: running" || echo "rclone: NOT running"

# Check the proxy chain is still active
ss -tlnp | grep -E "53682|53683"
docker exec gsa-ai-browser netstat -tlnp 2>/dev/null | grep 53682

echo ""
echo "=== CREATE NEW TAB WITH GOOGLE OAUTH ==="
# Use CDP HTTP API to create a new page
TAB_INFO=$(curl -s "http://127.0.0.1:9228/json/new?${encodedUrl}")
echo "Tab created: $TAB_INFO"

# Wait for the OAuth flow to proceed
sleep 5

echo ""
echo "=== LIST ALL TABS ==="
curl -s "http://127.0.0.1:9228/json/list" | python3 -c "
import json, sys
tabs = json.load(sys.stdin)
for t in tabs:
    print(f'  {t.get(\"id\",\"?\")[:20]}  {t.get(\"url\",\"?\")}  [{t.get(\"title\",\"?\")}]')
"

echo ""
echo "=== RCLONE OUTPUT ==="
cat /tmp/rclone-auth-output.txt
`;

  console.log('Creating new browser tab for OAuth...');
  const res = await runSshScript(script, 30000);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
}

main().catch(console.error);
