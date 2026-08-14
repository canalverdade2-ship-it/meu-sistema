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

console.log('1️⃣ Enviando compra direta...');
const purchaseMsg = `👋 Olá! Gostaria de comprar este produto na Loja GSA:

📦 Produto: Lâmpada Led Tubular 9w Branco Frio 6500k 60cm Margirius
🔮 Código: SHP-23693685729
📦 Quantidade: 1 unidade(s)
💵 Valor: R$ 14,64
🔗 Link: http://10.0.2.2:3000/marketplace/loja/produtos/3642b591-554c-49a9-8c07-6beec30995b9

🤖 #COMPRA_LOJA_GSA`;

sendMsg('5511971858372', purchaseMsg, () => {
  setTimeout(() => {
    console.log('2️⃣ Enviando 3 (Opção de Endereço)...');
    sendMsg('5511971858372', '3', () => {
      setTimeout(() => {
        console.log('3️⃣ Enviando 1 (Confirmar Endereço Cadastrado)...');
        sendMsg('5511971858372', '1', () => {
          setTimeout(() => {
            console.log('4️⃣ Enviando 1 (Pagar via PIX com endereço confirmado)...');
            sendMsg('5511971858372', '1', () => {
              console.log('✅ Finalizado teste');
            });
          }, 3000);
        });
      }, 3000);
    });
  }, 3000);
});
