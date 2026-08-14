'use strict';
const http = require('http');

function sendMsg(fromPhone, text, callback) {
  const payload = JSON.stringify({
    event: 'messages.upsert',
    instance: 'GSA_WhatsApp',
    data: {
      key: { remoteJid: `${fromPhone}@s.whatsapp.net`, fromMe: false, id: 'TEST_' + Date.now() },
      pushName: 'Adriano Farias',
      message: { conversation: text }
    }
  });

  const req = http.request({
    hostname: '127.0.0.1',
    port: 5680,
    path: '/webhook',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, (res) => {
    res.on('data', () => {});
    res.on('end', () => callback(null));
  });
  req.on('error', err => callback(err));
  req.write(payload);
  req.end();
}

console.log('1️⃣ Enviando mensagem de compra direta (#COMPRA_LOJA_GSA)...');
const purchaseMsg = `👋 Olá! Gostaria de comprar este produto na Loja GSA:

📦 Produto: Lâmpada Led Tubular 9w Branco Frio 6500k 60cm Margirius
🔮 Código: SHP-23693685729
📦 Quantidade: 1 unidade(s)
💵 Valor: R$ 14,64
🔗 Link: http://10.0.2.2:3000/marketplace/loja/produtos/3642b591-554c-49a9-8c07-6beec30995b9

🤖 #COMPRA_LOJA_GSA`;

sendMsg('5511971858372', purchaseMsg, (err) => {
  if (err) console.error('Erro step 1:', err);
  console.log('Mensagem 1 enviada. Aguardando 3s...');
  setTimeout(() => {
    console.log('2️⃣ Enviando resposta 1 (PIX)...');
    sendMsg('5511971858372', '1', (err2) => {
      if (err2) console.error('Erro step 2:', err2);
      console.log('Resposta 1 enviada!');
    });
  }, 3000);
});
