import fs from 'node:fs';
const file = String.raw`C:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\src\components\admin\super-domains\financeiro\FinanceiroSuperDomain.tsx`;
let text=fs.readFileSync(file,'utf8');
const one=(a,b,l)=>{const n=text.split(a).length-1;if(n!==1)throw new Error(`${l}:${n}`);text=text.replace(a,b)};
one(`if (['emprestimos_credito', 'emprestimos', 'credito'].includes(tab)) return 'emprestimos_credito';`, `if (['emprestimos_credito', 'emprestimos', 'credito', 'contestacoes'].includes(tab)) return 'emprestimos_credito';`, 'normalize');
one(`          <EmprestimosCreditoView\n            initialSubTab={initialSubTab as any}\n            initialItemId={initialItemId}`, `          <EmprestimosCreditoView\n            initialSubTab={(initialTab === 'contestacoes' ? 'contestacoes' : initialSubTab) as any}\n            initialItemId={initialItemId}`, 'subtab');
fs.writeFileSync(file,text,'utf8');
console.log('FINANCE_NAV_PATCH_OK');
