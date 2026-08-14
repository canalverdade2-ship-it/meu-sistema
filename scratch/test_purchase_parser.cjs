'use strict';

function parseStorePurchaseMessage(text) {
  let prodName = '';
  let prodCode = '';
  let prodQty = 1;
  let prodPrice = 0;
  let prodUuid = '';

  const lines = text.split(/\r?\n/);
  for (const rawLine of lines) {
    // Remove leading emojis/special characters and extra whitespace
    const line = rawLine.replace(/^[^\w\*a-zA-Z0-9#]+/g, '').trim();

    // Check for Produto / Item line
    if (!prodName && /^\*?(?:produto|item)\*?:\s*/i.test(line)) {
      prodName = line.replace(/^\*?(?:produto|item)\*?:\s*/i, '').replace(/[\*\_]/g, '').trim();
    }

    // Check for Código / Ref / Cod line
    if (!prodCode && /^\*?(?:código|codigo|ref|cod)\*?:\s*/i.test(line)) {
      prodCode = line.replace(/^\*?(?:código|codigo|ref|cod)\*?:\s*/i, '').replace(/[\*\_]/g, '').trim();
    }

    // Check for Quantidade line
    if (/^\*?(?:quantidade|qtd)\*?:\s*/i.test(line)) {
      const qMatch = line.match(/\b(\d+)\b/);
      if (qMatch) {
        prodQty = parseInt(qMatch[1], 10) || 1;
      }
    }

    // Check for Valor / Preço line
    if (prodPrice === 0 && /^\*?(?:valor|preço|preco)\*?:\s*/i.test(line)) {
      const vMatch = line.match(/R\$\s*([\d\.,]+)/i);
      if (vMatch && vMatch[1]) {
        const cleanP = vMatch[1].replace(/\./g, '').replace(',', '.');
        prodPrice = parseFloat(cleanP) || 0;
      }
    }

    // Check for Link line or UUID
    if (!prodUuid) {
      const uMatch = rawLine.match(/produtos\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
      if (uMatch && uMatch[1]) {
        prodUuid = uMatch[1];
      }
    }
  }

  // Fallback for code if not found by line
  if (!prodCode) {
    const rawCodeMatch = text.match(/(SHP-[\w-]+|PROD-[\w-]+|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
    if (rawCodeMatch) prodCode = rawCodeMatch[1].trim();
  }

  return {
    prodName: prodName || 'Produto da Loja GSA',
    prodCode: prodCode || (prodUuid ? `PROD-${prodUuid.substring(0,8).toUpperCase()}` : 'PROD-LOJA'),
    prodQty: prodQty > 0 ? prodQty : 1,
    prodPrice: prodPrice > 0 ? prodPrice : 0,
    prodUuid: prodUuid
  };
}

const msg1 = `👋 Olá! Gostaria de comprar este produto na Loja GSA:

📦 Produto: Lâmpada Led Tubular 9w Branco Frio 6500k 60cm Margirius
🔮 Código: SHP-23693685729
📦 Quantidade: 1 unidade(s)
💵 Valor: R$ 14,64
🔗 Link: http://10.0.2.2:3000/marketplace/loja/produtos/3642b591-554c-49a9-8c07-6beec30995b9

🤖 #COMPRA_LOJA_GSA`;

const msg2 = `👋 *Olá! Gostaria de comprar este produto na Loja GSA:*

🛒 *Produto:* Lâmpada Led Tubular 9w Branco Frio 6500k 60cm Margirius
🔖 *Código:* SHP-23693685729
📦 *Quantidade:* 2 unidade(s)
💵 *Valor:* R$ 29,28 (ou R$ 27,82 com desconto no PIX)
🔗 *Link:* https://gsa.com.br/marketplace/loja/produtos/3642b591-554c-49a9-8c07-6beec30995b9

🤖 _#COMPRA_LOJA_GSA_`;

console.log('Result 1:', JSON.stringify(parseStorePurchaseMessage(msg1), null, 2));
console.log('Result 2:', JSON.stringify(parseStorePurchaseMessage(msg2), null, 2));
