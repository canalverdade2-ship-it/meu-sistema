'use strict';
const https = require('https');

const payload = JSON.stringify({
  handle: 'getsemani-gsa',
  items: [{
    quantity: 1,
    price: 5, // 5 centavos = R$ 0.05
    description: 'Pedido Teste ODC-REAL - Grupo GSA'
  }],
  order_nsu: 'TEST-NSU-' + Date.now(),
  redirect_url: 'https://sistema.grupogsaservicos.com.br/marketplace/loja/compras',
  customer: {
    name: 'Adriano Farias',
    email: 'adriano@grupogsa.com.br',
    phone_number: '+5511971858372'
  }
});

console.log('Testing https://api.infinitepay.io/invoices/public/checkout/links ...');

const req1 = https.request('https://api.infinitepay.io/invoices/public/checkout/links', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status api.infinitepay.io:', res.statusCode);
    console.log('Body api.infinitepay.io:', data);
  });
});
req1.on('error', e => console.error('Err 1:', e));
req1.write(payload);
req1.end();

const req2 = https.request('https://api.checkout.infinitepay.io/links', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status api.checkout.infinitepay.io:', res.statusCode);
    console.log('Body api.checkout.infinitepay.io:', data);
  });
});
req2.on('error', e => console.error('Err 2:', e));
req2.write(payload);
req2.end();
