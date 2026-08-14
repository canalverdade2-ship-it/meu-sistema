'use strict';

function parseStorePurchaseMessage(text) {
  let prodName = '';
  let prodCode = '';
  let prodQty = 1;
  let prodPrice = 0;
  let prodUuid = '';

  const lines = text.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.replace(/^[^\w\*a-zA-Z0-9#]+/g, '').trim();

    if (!prodName && /^\*?(?:produto|item)\*?:\s*/i.test(line)) {
      prodName = line.replace(/^\*?(?:produto|item)\*?:\s*/i, '').replace(/[\*\_]/g, '').trim();
    }

    if (!prodCode && /^\*?(?:código|codigo|ref|cod)\*?:\s*/i.test(line)) {
      prodCode = line.replace(/^\*?(?:código|codigo|ref|cod)\*?:\s*/i, '').replace(/[\*\_]/g, '').trim();
    }

    if (/^\*?(?:quantidade|qtd)\*?:\s*/i.test(line)) {
      const qMatch = line.match(/\b(\d+)\b/);
      if (qMatch) {
        prodQty = parseInt(qMatch[1], 10) || 1;
      }
    }

    if (prodPrice === 0 && /^\*?(?:valor|preço|preco)\*?:\s*/i.test(line)) {
      const vMatch = line.match(/R\$\s*([\d\.,]+)/i);
      if (vMatch && vMatch[1]) {
        const cleanP = vMatch[1].replace(/\./g, '').replace(',', '.');
        prodPrice = parseFloat(cleanP) || 0;
      }
    }

    if (!prodUuid) {
      const uMatch = rawLine.match(/produtos\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
      if (uMatch && uMatch[1]) {
        prodUuid = uMatch[1];
      }
    }
  }

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

console.log('Parser test OK');
