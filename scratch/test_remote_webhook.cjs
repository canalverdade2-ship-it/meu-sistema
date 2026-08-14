'use strict';
const http = require('http');

const payload = JSON.stringify({
  event: 'messages.upsert',
  instance: 'GSA_WhatsApp',
  data: {
    key: {
      remoteJid: '5511920857756@s.whatsapp.net',
      fromMe: false,
      id: 'TEST_PURCHASE_SIMULATION_' + Date.now()
    },
    pushName: 'Adriano Farias',
    message: {
      conversation: `👋 Olá! Gostaria de comprar este produto na Loja GSA:

📦 Produto: Lâmpada Led Tubular 9w Branco Frio 6500k 60cm Margirius
🔮 Código: SHP-23693685729
📦 Quantidade: 1 unidade(s)
💵 Valor: R$ 14,64
🔗 Link: http://10.0.2.2:3000/marketplace/loja/produtos/3642b591-554c-49a9-8c07-6beec30995b9

🤖 #COMPRA_LOJA_GSA`
    },
    messageType: 'conversation'
  }
});

const req = http.request({
  hostname: '147.15.43.141',
  port: 5680,
  path: '/webhook',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
}, (res) => {
  let body = '';
  res.on('data', d => { body += d; });
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Response: ${body}`);
  });
});

req.on('error', (err) => {
  console.error('Request error:', err.message);
});

req.write(payload);
req.end();
