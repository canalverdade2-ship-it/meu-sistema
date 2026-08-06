const http = require('http');

const payload = JSON.stringify({
  data: {
    key: { remoteJid: '5511999999999@s.whatsapp.net' },
    message: { conversation: 'ola' }
  }
});

const req = http.request({
  hostname: 'localhost',
  port: 5680,
  path: '/webhook',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
}, (res) => {
  console.log('Status:', res.statusCode);
  res.on('data', d => process.stdout.write(d));
});

req.on('error', console.error);
req.write(payload);
req.end();
