const https = require('https');

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log('Response headers:', JSON.stringify(res.headers, null, 2));
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function run() {
  const orderNsu = `PIXTEST-${Date.now()}`;
  
  // Test multiple InfinitePay endpoints to find one that returns pix_code
  const endpoints = [
    // Endpoint 1: checkout status check
    { 
      hostname: 'api.checkout.infinitepay.io',
      path: '/payment_check',
      body: { order_nsu: 'ODC-80BD7B2A74-1786730349462', handle: 'getsemani-gsa' }
    },
    // Endpoint 2: Try the invoice public checkout endpoint (old)
    {
      hostname: 'api.infinitepay.io',
      path: '/invoices/public/checkout/links',
      body: {
        handle: 'getsemani-gsa',
        items: [{ quantity: 1, price: 100, description: 'Teste PIX' }],
        order_nsu: orderNsu,
      }
    },
    // Endpoint 3: Try direct PIX transaction API
    {
      hostname: 'api.infinitepay.io',
      path: '/v2/transactions',
      body: {
        amount: 100,
        capture_method: 'pix',
        installments: 1,
        order_id: orderNsu,
        description: 'Teste GSA PIX',
      }
    },
  ];

  for (const ep of endpoints) {
    console.log(`\n=== Testing: ${ep.hostname}${ep.path} ===`);
    const bodyStr = JSON.stringify(ep.body);
    try {
      const result = await request({
        hostname: ep.hostname,
        path: ep.path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
        }
      }, bodyStr);
      
      console.log('Status:', result.status);
      if (typeof result.body === 'object') {
        console.log('Fields:', Object.keys(result.body));
        console.log('Body:', JSON.stringify(result.body, null, 2).substring(0, 1000));
      } else {
        console.log('Body (text):', String(result.body).substring(0, 500));
      }
    } catch(e) {
      console.log('ERROR:', e.message);
    }
  }
}

run().catch(console.error);
