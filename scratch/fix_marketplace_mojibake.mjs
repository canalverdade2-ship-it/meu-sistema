import fs from 'node:fs';
const files=['src/components/client/store/CheckoutModal.tsx','src/components/client/store/EcommerceHome.tsx','src/components/admin/ProdutosModule.tsx','src/components/admin/OrdensCompraModule.tsx'];
const replacements=new Map([
  ['â”€','─'], ['10Ã—','10×'], ['Â©','©'], ['ðŸ·ï¸','🏷️'],
  ['⚠️ ï¸','⚠️'], ['âœ¨','✨'], ['âœ…','✅'], ['âœï¸','✏️'],
]);
for(const p of files){let s=fs.readFileSync(p,'utf8');for(const [a,b] of replacements)s=s.split(a).join(b);fs.writeFileSync(p,s,'utf8');}
console.log('MOJIBAKE_FIXED');
