import fs from 'node:fs';
const p = String.raw`C:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\src\pages\AdvertiserPortal.tsx`;
let s = fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');
const old = "      window.open(checkout.href, '_blank', 'noopener,noreferrer');\n      toast.success('Pagamento seguro aberto em uma nova aba.');";
const next = "      window.location.assign(checkout.href);";
if (!s.includes(next)) { if (!s.includes(old)) throw new Error('checkout navigation marker missing'); s = s.replace(old,next); }
fs.writeFileSync(p,s,'utf8');
console.log('checkout navigation patched');
