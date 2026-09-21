import { runSshScript } from 'file:///c:/Users/Adriano%20Farias/Downloads/remix-9.10_-grupo-gsa---gest%C3%A3o-de-servi%C3%A7os%20-%20Copia%20(4)/scratch/ssh2-run.mjs';

async function main() {
  const googleOAuthUrl = 'https://accounts.google.com/o/oauth2/auth?access_type=offline&client_id=202264815644.apps.googleusercontent.com&redirect_uri=http%3A%2F%2F127.0.0.1%3A53682%2F&response_type=code&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive&state=pEhibMVqMPIwpTf081-k3A';

  // CDP script that navigates browser, handles Google OAuth consent
  const cdpScript = `
const http = require('http');
const WebSocket = require('ws');

async function main() {
  const versionData = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9228/json/version', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
  
  const ws = new WebSocket(versionData.webSocketDebuggerUrl);
  let msgId = 1;
  const pending = new Map();
  const events = [];
  
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
    if (msg.method) events.push(msg);
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
  
  // Create a new tab
  const { result: target } = await send('Target.createTarget', { url: 'about:blank' });
  const targetId = target.targetId;
  console.log('Tab created:', targetId);
  
  const { result: session } = await send('Target.attachToTarget', { targetId, flatten: true });
  const sessionId = session.sessionId;
  
  function sendS(method, params = {}) {
    return new Promise((resolve) => {
      const id = msgId++;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }
  
  await sendS('Page.enable');
  await sendS('Network.enable');
  await sendS('Runtime.enable');
  
  // Helper: wait for page load
  async function waitForLoad(timeoutMs = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      await new Promise(r => setTimeout(r, 500));
      const { result } = await sendS('Runtime.evaluate', { expression: 'document.readyState' });
      if (result?.result?.value === 'complete') return;
    }
  }
  
  // Helper: get current URL
  async function getUrl() {
    const { result } = await sendS('Runtime.evaluate', { expression: 'document.location.href' });
    return result?.result?.value;
  }
  
  // Helper: get page text
  async function getText() {
    const { result } = await sendS('Runtime.evaluate', { expression: 'document.body?.innerText?.substring(0, 3000)' });
    return result?.result?.value;
  }
  
  // Helper: click element by selector
  async function click(selector) {
    const { result } = await sendS('Runtime.evaluate', {
      expression: \`(() => {
        const el = document.querySelector('\${selector}');
        if (el) { el.click(); return 'clicked'; }
        return 'not found';
      })()\`
    });
    return result?.result?.value;
  }
  
  // Helper: click element by text content
  async function clickByText(text) {
    const { result } = await sendS('Runtime.evaluate', {
      expression: \`(() => {
        const els = Array.from(document.querySelectorAll('button, a, div[role="button"], span'));
        const el = els.find(e => e.textContent.includes('\${text}'));
        if (el) { el.click(); return 'clicked: ' + el.tagName + ' ' + el.textContent.substring(0, 50); }
        return 'not found: ' + text;
      })()\`
    });
    return result?.result?.value;
  }
  
  // Navigate to Google OAuth
  const authUrl = ${JSON.stringify(googleOAuthUrl)};
  console.log('Navigating to Google OAuth...');
  await sendS('Page.navigate', { url: authUrl });
  await waitForLoad();
  
  let url = await getUrl();
  console.log('URL after navigate:', url);
  let text = await getText();
  console.log('Page text:', text?.substring(0, 500));
  
  // The flow might show:
  // 1. Account chooser (if multiple accounts) - click the right account
  // 2. Consent screen - click "Allow" / "Continue"
  // 3. Success page - redirect to 127.0.0.1:53682
  
  // Handle flow - iterate up to 10 times
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 2000));
    url = await getUrl();
    text = await getText();
    console.log(\`\\nIteration \${i+1}: URL = \${url}\`);
    console.log('Text preview:', text?.substring(0, 300));
    
    // If we hit the success page on rclone
    if (url?.includes('127.0.0.1:53682') || text?.includes('Success') || text?.includes('All done')) {
      console.log('\\n=== SUCCESS! OAuth completed! ===');
      break;
    }
    
    // If on account chooser, click the account
    if (url?.includes('signin/identifier') || url?.includes('AccountChooser') || text?.includes('adriano9865')) {
      console.log('Account chooser detected, clicking account...');
      let r = await clickByText('adriano9865');
      console.log('Click result:', r);
      if (r?.includes('not found')) {
        // Try clicking any account link
        r = await click('[data-email]');
        console.log('Click data-email result:', r);
      }
      await new Promise(r2 => setTimeout(r2, 3000));
      await waitForLoad();
      continue;
    }
    
    // If on consent screen
    if (text?.includes('Allow') || text?.includes('Permitir') || text?.includes('Grant') || text?.includes('Continue') || text?.includes('Continuar')) {
      console.log('Consent screen detected...');
      // Try various consent buttons
      for (const btnText of ['Allow', 'Permitir', 'Continue', 'Continuar', 'Grant access']) {
        let r = await clickByText(btnText);
        if (r?.includes('clicked')) {
          console.log('Clicked:', btnText, '-', r);
          await new Promise(r2 => setTimeout(r2, 3000));
          break;
        }
      }
      await waitForLoad();
      continue;
    }
    
    // If there's an "advanced" or "unsafe app" warning
    if (text?.includes('advanced') || text?.includes('unsafe') || text?.includes('não verificado') || text?.includes('unverified')) {
      console.log('Unsafe app warning detected...');
      let r = await clickByText('Advanced');
      if (r?.includes('not found')) r = await clickByText('Avançado');
      console.log('Advanced click:', r);
      await new Promise(r2 => setTimeout(r2, 1000));
      
      // Then click "Go to..." or "Ir para..."
      r = await clickByText('Go to');
      if (r?.includes('not found')) r = await clickByText('Ir para');
      if (r?.includes('not found')) r = await clickByText('unsafe');
      console.log('Go to click:', r);
      await new Promise(r2 => setTimeout(r2, 2000));
      await waitForLoad();
      continue;
    }
  }
  
  // Close tab and disconnect
  await send('Target.closeTarget', { targetId });
  ws.close();
  console.log('\\nDone.');
}

main().catch(e => { console.error(e); process.exit(1); });
`;

  // Write and execute the CDP script on VPS
  const b64 = Buffer.from(cdpScript).toString('base64');
  
  const script = `
echo "${b64}" | base64 -d > /tmp/cdp-oauth-flow.js
NODE_PATH=/tmp/node_modules timeout 120 node /tmp/cdp-oauth-flow.js 2>&1
`;

  console.log('Running OAuth flow via CDP...');
  const res = await runSshScript(script, 130000);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
  
  // Check rclone output for token
  console.log('\n=== CHECK RCLONE TOKEN ===');
  const r2 = await runSshScript(`cat /tmp/rclone-auth-output.txt`, 10000);
  console.log(r2.stdout);
}

main().catch(console.error);
