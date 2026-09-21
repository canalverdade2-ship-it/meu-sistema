import fs from 'node:fs';
const p = 'src/components/client/store/CheckoutPage.tsx';
let s = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
function once(re, replacement, label) {
  const flags = re.flags.includes('g') ? re.flags : re.flags + 'g';
  const matches = [...s.matchAll(new RegExp(re.source, flags))];
  if (matches.length !== 1) throw new Error(`${label}: ${matches.length}`);
  s = s.replace(re, replacement);
}
once(/(type CartItem = \{[\s\S]*?quantidade: number;)/, `$1\n  produto_variante_id?: string | null;`, 'cart type');
once(/(id: `guest-\$\{item\.tipo\}-\$\{item\.item_id\}`,[\s\S]*?prazo_meses: item\.prazo_meses,\n\s+)(item_detalhes: detalhes)/, `$1produto_variante_id: item.produto_variante_id || null,\n            $2`, 'guest variant');
once(/(const enriched: CartItem\[\] = items\.map[\s\S]*?prazo_meses: item\.prazo_meses,\n\s+)(item_detalhes: detalhes)/, `$1produto_variante_id: item.produto_variante_id || null,\n          $2`, 'auth variant');
const payloadPattern = /(quantidade: item\.quantidade,\n\s+)(\.\.\.\(item\.tipo === 'assinatura')/g;
const payloadMatches = [...s.matchAll(payloadPattern)].length;
if (payloadMatches !== 1) throw new Error(`checkout payload: ${payloadMatches}`);
s = s.replace(payloadPattern, `$1...(item.tipo === 'produto' ? { variante_id: item.produto_variante_id || null } : {}),\n            $2`);
s = s.replace(/\n\s+valorLiquido: totalHojeFinal,/g, '');
once(/(if \(formaPagamento === 'pix'\) \{[\s\S]*?const checkoutInfo = await createInfinitePayOrderCheckout\([\s\S]*?\);\n\s+)(setPixModalData\(\{)/, `$1if (!checkoutInfo.success) throw new Error(checkoutInfo.error || 'Não foi possível gerar a cobrança.');\n\n        $2`, 'pix guard');
once(/(if \(formaPagamento === 'cartao'\) \{[\s\S]*?const checkoutInfo = await createInfinitePayOrderCheckout\([\s\S]*?\);\n\s+)(checkoutRequestId\.current)/, `$1if (!checkoutInfo.success) throw new Error(checkoutInfo.error || 'Não foi possível gerar a cobrança.');\n\n        $2`, 'card guard');
s = s.replace(/total: totalHojeFinal,/g, 'total: checkoutInfo.total ?? totalHojeFinal,');
fs.writeFileSync(p, s, 'utf8');
console.log('CHECKOUT_PAGE_PATCHED');
