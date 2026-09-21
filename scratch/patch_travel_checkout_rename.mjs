import fs from 'node:fs';
const old='src/components/client/store/CheckoutModal.tsx';
const neu='src/components/client/store/TravelCheckoutModal.tsx';
let s=fs.readFileSync(old,'utf8').replace(/\r\n/g,'\n');
s=s.replace('export default function CheckoutModal(', 'export default function TravelCheckoutModal(');
s=s.replace(/\n\s+valorLiquido: totalHojeFinal,/g,'');
s=s.replace(/total: totalHojeFinal,/g,'total: checkoutInfo.total ?? totalHojeFinal,');
s=s.replace("toast.success('ðŸŽ‰ Pedido Registrado! Abrindo pagamento seguro do cartão...'", "toast.success('🎉 Pedido Registrado! Abrindo pagamento seguro do cartão...'");
const pix=/((?:if \(formaPagamento === 'pix'\) \{)[\s\S]*?const checkoutInfo = await createInfinitePayOrderCheckout\([\s\S]*?\);\n\s+)(setPixModalData\(\{)/;
if(!pix.test(s)) throw new Error('pix guard target missing');
s=s.replace(pix,`$1if (!checkoutInfo.success) throw new Error(checkoutInfo.error || 'Não foi possível gerar a cobrança.');\n\n        $2`);
const card=/((?:if \(formaPagamento === 'cartao'\) \{)[\s\S]*?const checkoutInfo = await createInfinitePayOrderCheckout\([\s\S]*?\);\n\s+)(toast\.success)/;
if(!card.test(s)) throw new Error('card guard target missing');
s=s.replace(card,`$1if (!checkoutInfo.success) throw new Error(checkoutInfo.error || 'Não foi possível gerar a cobrança.');\n\n        $2`);
fs.writeFileSync(neu,s,'utf8'); fs.unlinkSync(old);
for (const p of ['src/components/client/marketplace/travel/TravelReservationPage.tsx','src/tests/realtime-hook.test.ts']) {
  let t=fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');
  t=t.replace(/CheckoutModal/g,'TravelCheckoutModal').replace(/store\/TravelCheckoutModal/g,'store/TravelCheckoutModal');
  if(p.includes('TravelReservationPage')) t=t.replace("import TravelCheckoutModal from '../../store/TravelCheckoutModal';", "import TravelCheckoutModal from '../../store/TravelCheckoutModal';");
  fs.writeFileSync(p,t,'utf8');
}
console.log('TRAVEL_CHECKOUT_RENAMED');
