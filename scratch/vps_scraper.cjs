
const http = require('http');

function request(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function createSession() {
  const postData = JSON.stringify({
    capabilities: {
      alwaysMatch: {
        browserName: 'chrome',
        'goog:chromeOptions': {
          args: ['--headless', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage', '--window-size=1920,1080']
        }
      }
    }
  });

  const res = await request({
    hostname: '127.0.0.1',
    port: 4444,
    path: '/session',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  }, postData);

  return res.value.sessionId;
}

async function executeScript(sessionId, script, args = []) {
  const postData = JSON.stringify({ script, args });
  const res = await request({
    hostname: '127.0.0.1',
    port: 4444,
    path: '/session/' + sessionId + '/execute/sync',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  }, postData);
  return res.value;
}

async function navigate(sessionId, url) {
  const postData = JSON.stringify({ url });
  await request({
    hostname: '127.0.0.1',
    port: 4444,
    path: '/session/' + sessionId + '/url',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  }, postData);
}

async function closeSession(sessionId) {
  await request({
    hostname: '127.0.0.1',
    port: 4444,
    path: '/session/' + sessionId,
    method: 'DELETE'
  });
}

async function scrapeShopeeVariations(url) {
  console.log('Starting Selenium session...');
  const sessionId = await createSession();
  console.log('Session created:', sessionId);

  try {
    console.log('Navigating to:', url);
    await navigate(sessionId, url);
    await new Promise(r => setTimeout(r, 6000));

    console.log('Extracting variation data from DOM...');
    const result = await executeScript(sessionId, `
      // Look for variation buttons and images
      const data = {
        title: document.title,
        variationButtons: [],
        images: []
      };

      // Find all images on the page
      document.querySelectorAll('img').forEach(img => {
        if (img.src && (img.src.includes('susercontent.com') || img.src.includes('shopee.com.br'))) {
          data.images.push(img.src);
        }
      });

      // Find variation buttons with thumbnails
      document.querySelectorAll('.product-variation, [aria-label], button').forEach(el => {
        const text = el.innerText || el.getAttribute('aria-label') || '';
        const img = el.querySelector('img');
        if (text && img && img.src) {
          data.variationButtons.push({ text: text.trim(), image: img.src });
        }
      });

      return data;
    `);

    console.log('Scraped result:', JSON.stringify(result, null, 2));
    return result;

  } finally {
    console.log('Closing session...');
    await closeSession(sessionId);
  }
}

scrapeShopeeVariations('https://shopee.com.br/product/217877619/28671600689').catch(console.error);
