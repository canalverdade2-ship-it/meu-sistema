const https = require('https');

// Fetch the checkout page HTML to look for PIX EMV code embedded in it
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    req.end();
  });
}

// POST to create a checkout link
function httpPost(hostname, path, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function run() {
  // Step 1: Create a checkout link
  const orderNsu = `TESTEMV-${Date.now()}`;
  const t1 = await httpPost('api.checkout.infinitepay.io', '/links', {
    handle: 'getsemani-gsa',
    items: [{ quantity: 1, price: 100, description: 'Teste PIX GSA' }],
    order_nsu: orderNsu,
  });
  
  console.log('Checkout link created:', t1.body);
  const checkoutUrl = t1.body.url;
  
  if (!checkoutUrl) {
    console.error('No checkout URL returned');
    return;
  }
  
  // Step 2: Fetch the checkout page HTML
  console.log('\nFetching checkout page:', checkoutUrl);
  const page = await httpGet(checkoutUrl);
  console.log('Page status:', page.status);
  
  // Look for PIX-related data in the HTML
  const html = page.body;
  
  // Extract pix_code / qr_code patterns
  const patterns = [
    /pix[_\s]?code["']?\s*[=:]\s*["']([^"']+)/gi,
    /qr[_\s]?code["']?\s*[=:]\s*["']([^"']+)/gi,
    /emv["']?\s*[=:]\s*["']([^"']+)/gi,
    /copia[_\s]?e[_\s]?cola["']?\s*[=:]\s*["']([^"']+)/gi,
    /"pix"\s*:\s*\{[^}]+\}/gi,
    /00020126/g, // Start of PIX EMV string
  ];
  
  console.log('\n=== PIX Data Found in HTML ===');
  let foundAny = false;
  for (const pattern of patterns) {
    const matches = html.match(pattern);
    if (matches) {
      console.log(`Pattern: ${pattern}`);
      matches.slice(0, 3).forEach(m => console.log(' -', m.substring(0, 200)));
      foundAny = true;
    }
  }
  
  if (!foundAny) {
    console.log('No PIX EMV data found directly in HTML.');
    
    // Look for script tags with JSON data
    const scriptMatches = html.match(/<script[^>]*>([^<]{100,})<\/script>/g);
    if (scriptMatches) {
      console.log('\nScript tags found:', scriptMatches.length);
      scriptMatches.slice(0, 2).forEach((s, i) => {
        console.log(`Script ${i+1} (first 500 chars):`, s.substring(0, 500));
      });
    }
    
    // Look for Next.js __NEXT_DATA__ or similar
    const nextDataMatch = html.match(/__NEXT_DATA__\s*=\s*(\{.+?\})\s*<\/script>/s);
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        console.log('\n__NEXT_DATA__ found:', JSON.stringify(nextData, null, 2).substring(0, 2000));
      } catch(e) {
        console.log('Could not parse __NEXT_DATA__');
      }
    }
    
    // Check redirects or meta refresh
    const metaRefresh = html.match(/<meta[^>]+refresh[^>]+>/gi);
    if (metaRefresh) console.log('\nMeta refresh:', metaRefresh);
    
    // Show first 2000 chars of HTML  
    console.log('\nHTML preview (first 2000):', html.substring(0, 2000));
  }
}

run().catch(console.error);
