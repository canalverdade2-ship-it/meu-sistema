import fs from 'node:fs';
for(const p of ['src/components/client/store/CheckoutPixModal.tsx','src/components/client/store/PurchasesPage.tsx']){
  let s=fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');
  s=s.replace(/\n\s+valorLiquido: [^,\n]+,/g,'');
  fs.writeFileSync(p,s,'utf8');
}
const p='src/lib/pixService.ts';
let s=fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');
const needle='  clienteId: string;\n  clienteNome?: string;';
if(!s.includes(needle)) throw new Error('pix type target missing');
s=s.replace(needle,`  clienteId: string;\n  /** @deprecated Ignorado. O valor financeiro é sempre obtido no servidor. */\n  valorLiquido?: number;\n  clienteNome?: string;`);
fs.writeFileSync(p,s,'utf8');
console.log('INFINITEPAY_CALLERS_PATCHED');
