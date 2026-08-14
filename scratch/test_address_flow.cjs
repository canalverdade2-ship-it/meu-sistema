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
  console.log('Step 1 enviado. Aguardando 2s...');

  setTimeout(() => {
    console.log('2️⃣ Enviando opção 3 (Informar Endereço / Calcular Frete)...');
    sendMsg('5511971858372', '3', (err2) => {
      if (err2) console.error('Erro step 2:', err2);
      console.log('Step 2 (opção 3) enviado. Aguardando 2s...');

      setTimeout(() => {
        console.log('3️⃣ Enviando opção 1 (Confirmar endereço cadastrado)...');
        sendMsg('5511971858372', '1', (err3) => {
          if (err3) console.error('Erro step 3:', err3);
          console.log('Step 3 (confirmar endereço) enviado. Aguardando 2s...');

          setTimeout(() => {
            console.log('4️⃣ Enviando opção 1 (Pagar via PIX)...');
            sendMsg('5511971858372', '1', (err4) => {
              if (err4) console.error('Erro step 4:', err4);
              console.log('🎉 Fluxo completo enviado!');
            });
          }, 2000);
        });
      }, 2000);
    });
  }, 2000);
});
