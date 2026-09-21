import { runSshScript } from 'file:///c:/Users/Adriano%20Farias/Downloads/remix-9.10_-grupo-gsa---gest%C3%A3o-de-servi%C3%A7os%20-%20Copia%20(4)/scratch/ssh2-run.mjs';

async function main() {
  const googleOAuthUrl = 'https://accounts.google.com/o/oauth2/auth?access_type=offline&client_id=202264815644.apps.googleusercontent.com&redirect_uri=http%3A%2F%2F127.0.0.1%3A53682%2F&response_type=code&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive&state=pEhibMVqMPIwpTf081-k3A';

  // Use node on VPS to do everything via built-in http (no ws dependency)
  const nodeScript = `
const http = require('http');

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function httpPut(url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: 'PUT' }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  // Create new tab with the OAuth URL
  const authUrl = ${JSON.stringify(googleOAuthUrl)};
  
  // The /json/new?url endpoint format
  const newTabUrl = 'http://127.0.0.1:9228/json/new?' + encodeURIComponent(authUrl);
  console.log('Creating tab...');
  const tabInfo = await httpGet(newTabUrl);
  console.log('Tab info:', tabInfo);
  
  const tab = JSON.parse(tabInfo);
  const tabId = tab.id;
  console.log('Tab ID:', tabId);
  
  // Wait for page to load and OAuth to redirect
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 3000));
    
    // List tabs to see current URLs
    const tabsJson = await httpGet('http://127.0.0.1:9228/json/list');
    const tabs = JSON.parse(tabsJson);
    const ourTab = tabs.find(t => t.id === tabId);
    
    if (ourTab) {
      console.log('Iteration ' + (i+1) + ': URL=' + ourTab.url + ' Title=' + ourTab.title);
      
      // Check if we've been redirected to rclone success
      if (ourTab.url.includes('127.0.0.1:53682') && !ourTab.url.includes('accounts.google.com')) {
        console.log('SUCCESS! OAuth callback received!');
        break;
      }
      
      // Check if on consent/account chooser - we may need to use WebSocket for interaction
      if (ourTab.url.includes('accounts.google.com') && ourTab.title && !ourTab.title.includes('Sign in')) {
        console.log('On Google page, may need interaction...');
        console.log('Title:', ourTab.title);
      }
    } else {
      console.log('Tab not found in list');
    }
  }
  
  // Check rclone output
  const { execSync } = require('child_process');
  console.log('\\nRclone output:');
  console.log(execSync('cat /tmp/rclone-auth-output.txt').toString());
  
  // Close the tab
  try {
    await httpGet('http://127.0.0.1:9228/json/close/' + tabId);
    console.log('Tab closed');
  } catch(e) {}
}

main().catch(e => { console.error(e); process.exit(1); });
`;

  const b64 = Buffer.from(nodeScript).toString('base64');
  
  const script = `
echo "${b64}" | base64 -d > /tmp/cdp-oauth-simple.js
timeout 90 node /tmp/cdp-oauth-simple.js 2>&1
`;

  console.log('Running simplified OAuth flow...');
  const res = await runSshScript(script, 100000);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
}

main().catch(console.error);
