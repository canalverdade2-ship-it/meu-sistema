import { runSshScript } from 'file:///c:/Users/Adriano%20Farias/Downloads/remix-9.10_-grupo-gsa---gest%C3%A3o-de-servi%C3%A7os%20-%20Copia%20(4)/scratch/ssh2-run.mjs';

/**
 * Use the headless browser (CDP on port 9228) to complete rclone's OAuth flow.
 * The browser already has adriano9865@gmail.com logged in.
 * 
 * Strategy:
 * 1. Deploy a small Node.js script inside the browser container (or on the host)
 *    that uses CDP to navigate and handle the OAuth consent.
 * 2. The OAuth callback URL is http://127.0.0.1:53682/ which is the rclone server.
 *    Since the browser container maps ports, we need to ensure 127.0.0.1:53682 
 *    from the browser's perspective reaches the host's port 53682.
 */
async function main() {
  // The browser container likely shares host network or can access host via docker gateway.
  // Let's first check if the browser can reach 127.0.0.1:53682 (rclone's listener)
  // by deploying a CDP script on the VPS.
  
  const cdpScript = `
const http = require('http');
const WebSocket = require('ws');

async function main() {
  // Get browser websocket URL
  const versionData = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9228/json/version', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
  
  const wsUrl = versionData.webSocketDebuggerUrl;
  console.log('Connecting to browser:', wsUrl);
  
  const ws = new WebSocket(wsUrl);
  let msgId = 1;
  const pending = new Map();
  
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
    // Log navigation events
    if (msg.method === 'Page.frameNavigated') {
      console.log('Navigated to:', msg.params?.frame?.url);
    }
  });
  
  function send(method, params = {}) {
    return new Promise((resolve) => {
      const id = msgId++;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }
  
  await new Promise(r => ws.on('open', r));
  console.log('Connected to browser');
  
  // Create a new tab for the auth flow
  const { result: target } = await send('Target.createTarget', {
    url: 'about:blank'
  });
  console.log('Created tab:', target.targetId);
  
  // Attach to the tab
  const { result: session } = await send('Target.attachToTarget', {
    targetId: target.targetId,
    flatten: true
  });
  const sessionId = session.sessionId;
  console.log('Attached with session:', sessionId);
  
  function sendSession(method, params = {}) {
    return new Promise((resolve) => {
      const id = msgId++;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }
  
  // Enable Page events
  await sendSession('Page.enable');
  await sendSession('Network.enable');
  
  // Navigate to the rclone auth URL
  // The auth URL redirects to Google OAuth, then back to 127.0.0.1:53682
  const authUrl = 'http://127.0.0.1:53682/auth?state=97zfa5vulZbbVTAikrEoJg';
  console.log('Navigating to:', authUrl);
  
  // But wait - from the browser container's perspective, 127.0.0.1:53682 
  // refers to the container itself, not the host. 
  // Let's check if we can use the docker host gateway or if the container
  // uses host network mode.
  
  // Actually, we should navigate directly to the Google OAuth URL and let
  // the redirect go back. But the redirect_uri is 127.0.0.1:53682 which
  // needs to reach the VPS host where rclone is running.
  
  // Let's first check if the browser can reach host's 53682 port
  await sendSession('Page.navigate', { url: authUrl });
  
  // Wait for page to load
  await new Promise(r => setTimeout(r, 5000));
  
  // Get current URL
  const { result: evalResult } = await sendSession('Runtime.evaluate', {
    expression: 'document.location.href'
  });
  console.log('Current URL:', evalResult?.result?.value);
  
  // Get page content
  const { result: bodyResult } = await sendSession('Runtime.evaluate', {
    expression: 'document.body?.innerText?.substring(0, 2000)'
  });
  console.log('Page content:', bodyResult?.result?.value);
  
  // Wait more and check
  await new Promise(r => setTimeout(r, 3000));
  
  const { result: evalResult2 } = await sendSession('Runtime.evaluate', {
    expression: 'document.location.href'
  });
  console.log('Final URL:', evalResult2?.result?.value);
  
  const { result: bodyResult2 } = await sendSession('Runtime.evaluate', {
    expression: 'document.body?.innerText?.substring(0, 3000)'
  });
  console.log('Final content:', bodyResult2?.result?.value);
  
  // Close the tab
  await send('Target.closeTarget', { targetId: target.targetId });
  ws.close();
}

main().catch(e => { console.error(e); process.exit(1); });
`;

  // Write the CDP script to VPS and run it
  const b64Script = Buffer.from(cdpScript).toString('base64');
  
  const script = `
# Write the CDP script
echo "${b64Script}" | base64 -d > /tmp/cdp-oauth.js

# Check if ws module is available
node -e "require('ws')" 2>/dev/null && echo "ws module: OK" || echo "ws module: MISSING"

# If ws not available, install it temporarily
if ! node -e "require('ws')" 2>/dev/null; then
  cd /tmp && npm install ws 2>&1 | tail -3
  export NODE_PATH=/tmp/node_modules
fi

# Run the script
NODE_PATH=/tmp/node_modules timeout 30 node /tmp/cdp-oauth.js 2>&1
`;

  console.log('Running CDP OAuth script on VPS...');
  const res = await runSshScript(script, 60000);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
}

main().catch(console.error);
