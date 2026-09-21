import fs from 'node:fs';
const files=[
'src/pages/Fornecedor/FornecedorDashboard.tsx','src/components/admin/FornecedoresModule.tsx',
'src/lib/supplierOperations.ts','src/components/admin/SystemMonitorModule.tsx',
'src/components/admin/super-domains/pessoas/PessoasSuperDomain.tsx',
'scripts/check-supplier-procurement-contracts.ts','scripts/sql/check-supplier-flow.sql',
'supabase/migrations/20260829232500_supplier_security_financial_hardening.sql',
'supabase/migrations/20260829234000_secure_supplier_product_config_tables.sql'];
const badMarkers=['Ã','Â','âž','â€','ðŸ','ï¿½']; let bad=0;
for(const f of files){
 const b=fs.readFileSync(f); let s=''; let valid=true;
 try{s=new TextDecoder('utf-8',{fatal:true}).decode(b)}catch{valid=false;bad++}
 const replacement=s.includes('\uFFFD'); const markers=badMarkers.filter(x=>s.includes(x));
 if(replacement||markers.length) bad++;
 console.log(`${f}|utf8=${valid}|replacement=${replacement}|markers=${markers.join(',')||'none'}`);
}
console.log(`SUPPLIER_HARDENING_UTF8_BAD=${bad}`);
