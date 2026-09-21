import fs from 'node:fs';
const file=String.raw`C:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\src\types.ts`;
let text=fs.readFileSync(file,'utf8');
const old=`tipo: 'concessao_inicial' | 'compra' | 'amortizacao' | 'ajuste_adm_aumento' | 'ajuste_adm_reducao' | 'solicitacao_aumento_aprovada' | 'estorno_compra';`;
const n=text.split(old).length-1;if(n!==1)throw new Error(`tipo:${n}`);
text=text.replace(old,`tipo: 'concessao_inicial' | 'compra' | 'amortizacao' | 'ajuste_adm_aumento' | 'ajuste_adm_reducao' | 'solicitacao_aumento_aprovada' | 'estorno_compra' | 'cancelamento_limite';`);
fs.writeFileSync(file,text,'utf8'); console.log('TYPE_PATCH_OK');
