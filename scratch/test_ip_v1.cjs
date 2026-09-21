const https = require('https');

// Tentar a API de orders da InfinitePay que retorna QR Code e EMV
function request(hostname, path, method, payload, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const body = payload ? JSON.stringify(payload) : null;
    const options = {
      hostname,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
        ...extraHeaders,
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
        } catch(e) {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function run() {
  const orderNsu = `TESTPIX-${Date.now()}`;
  
  // Test 1: Try API v1 orders endpoint (used by many InfinitePay integrations)
  console.log('\n=== TEST: api.infinitepay.io/v1/orders ===');
  const t1 = await request('api.infinitepay.io', '/v1/orders', 'POST', {
    amount: 100,
    capture_method: 'pix',
    order_id: orderNsu,
    description: 'Teste GSA',
  });
  console.log('Status:', t1.status);
  if (typeof t1.body === 'object') {
    console.log('Fields:', Object.keys(t1.body));
    console.log('Body:', JSON.stringify(t1.body, null, 2).substring(0, 500));
  } else {
    console.log('Body:', String(t1.body).substring(0, 500));
  }

  // Test 2: Fetch the checkout page HTML and look for pix_code / qr_code
  console.log('\n=== TEST: Fetch checkout page ===');
  const checkoutUrl = 'https://api.checkout.infinitepay.io/links';
  const t2 = await request('api.checkout.infinitepay.io', '/links', 'POST', {
    handle: 'getsemani-gsa',
    items: [{ quantity: 1, price: 100, description: 'Teste' }],
    order_nsu: orderNsu,
    payment_methods: ['pix'],
  });
  console.log('Status:', t2.status);
  if (typeof t2.body === 'object') {
    console.log('Fields:', Object.keys(t2.body));
    console.log('Body:', JSON.stringify(t2.body, null, 2));
  } else {
    console.log('Body:', String(t2.body).substring(0, 1000));
  }
}

run().catch(console.error);
