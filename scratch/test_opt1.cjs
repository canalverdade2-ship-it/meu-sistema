'use strict';
const http = require('http');
const payload = JSON.stringify({
  event: 'messages.upsert',
  instance: 'GSA_WhatsApp',
  data: {
    key: { remoteJid: '5511920857756@s.whatsapp.net', fromMe: false, id: 'TEST_OPT_1_' + Date.now() },
    message: { conversation: '1' }
  }
});
const req = http.request({ hostname: '127.0.0.1', port: 5680, path: '/webhook', method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => {
  res.on('data', () => {});
  res.on('end', () => console.log('Done opt1 test'));
});
req.write(payload);
req.end();
