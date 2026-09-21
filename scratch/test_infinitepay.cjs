const https = require('https');

const INFINITEPAY_HANDLE = 'getsemani-gsa';

const payload = JSON.stringify({
  handle: INFINITEPAY_HANDLE,
  items: [{
    quantity: 1,
    price: 100,
    description: 'Teste GSA PIX',
  }],
  order_nsu: `TEST-${Date.now()}`,
});

const options = {
  hostname: 'api.checkout.infinitepay.io',
  path: '/links',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  }
};

console.log('Enviando requisição para InfinitePay...');

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    try {
      const parsed = JSON.parse(data);
      console.log('Campos retornados:', Object.keys(parsed));
      console.log('Resposta completa:', JSON.stringify(parsed, null, 2));
    } catch(e) {
      console.log('Texto da resposta:', data);
    }
  });
});

req.on('error', (e) => console.error('Erro:', e));
req.write(payload);
req.end();
