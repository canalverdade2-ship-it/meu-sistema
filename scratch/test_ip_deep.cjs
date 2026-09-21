const https = require('https');

// Testar se a API antiga de invoices retorna QR Code e pix_code
function testApi(hostname, path, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const options = {
      hostname,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch(e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function run() {
  const orderNsu = `TESTGSA-${Date.now()}`;
  
  // Test 1: New checkout links API (currently used)
  console.log('=== TEST 1: api.checkout.infinitepay.io/links ===');
  const t1 = await testApi('api.checkout.infinitepay.io', '/links', {
    handle: 'getsemani-gsa',
    items: [{ quantity: 1, price: 100, description: 'Teste GSA' }],
    order_nsu: orderNsu,
  });
  console.log('Status:', t1.status);
  console.log('Fields:', typeof t1.body === 'object' ? Object.keys(t1.body) : t1.body.substring(0, 200));
  console.log('Full:', JSON.stringify(t1.body, null, 2));

  // Test 2: Try the payment_check endpoint to understand structure
  console.log('\n=== TEST 2: api.checkout.infinitepay.io/payment_check ===');
  const t2 = await testApi('api.checkout.infinitepay.io', '/payment_check', {
    order_nsu: orderNsu,
    handle: 'getsemani-gsa',
  });
  console.log('Status:', t2.status);
  console.log('Fields:', typeof t2.body === 'object' ? Object.keys(t2.body) : t2.body.substring(0, 200));
}

run().catch(console.error);
