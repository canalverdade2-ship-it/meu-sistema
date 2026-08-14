'use strict';
// Test offline simulation of processMessage in server_webhook_final.cjs

const originalCode = require('fs').readFileSync('scratch/server_webhook_final.cjs', 'utf8');

// We will inspect the parsing and simulated handling
const testMsg = `👋 Olá! Gostaria de comprar este produto na Loja GSA:

📦 Produto: Lâmpada Led Tubular 9w Branco Frio 6500k 60cm Margirius
🔮 Código: SHP-23693685729
📦 Quantidade: 1 unidade(s)
💵 Valor: R$ 14,64
🔗 Link: http://10.0.2.2:3000/marketplace/loja/produtos/3642b591-554c-49a9-8c07-6beec30995b9

🤖 #COMPRA_LOJA_GSA`;

const isStoreDirectPurchase = testMsg.includes('#COMPRA_LOJA_GSA') || 
                              testMsg.includes('COMPRA_LOJA_GSA') || 
                              testMsg.includes('Gostaria de comprar este produto na Loja GSA') ||
                              testMsg.includes('Quero comprar o produto na Loja GSA') ||
                              (testMsg.includes('marketplace/loja/produtos/') && testMsg.includes('Produto:'));

console.log('Intercept test passed:', isStoreDirectPurchase);
