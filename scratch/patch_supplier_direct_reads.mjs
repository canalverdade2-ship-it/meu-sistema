import fs from 'node:fs';
const root='src/components/admin/';
let f=root+'SystemMonitorModule.tsx', s=fs.readFileSync(f,'utf8');
s=s.replace(/const \{ data: forns, error: fornsError \} = await supabase\.from\('fornecedores'\)\.select\('id, razao_social, email, created_at, status'\)\.limit\(100\);\r?\n\s*if \(fornsError\) throw fornsError;/,
`const supplierSnapshot = await callAdminRpc<any>('gsa_admin_supplier_snapshot');\n        const forns = Array.isArray(supplierSnapshot?.suppliers) ? supplierSnapshot.suppliers.slice(0, 100) : [];`);
if(s.includes("supabase.from('fornecedores')")) throw new Error('Leitura direta restante no SystemMonitor'); fs.writeFileSync(f,s,'utf8');
f=root+'super-domains/pessoas/PessoasSuperDomain.tsx'; s=fs.readFileSync(f,'utf8');
s=s.replace("import { formatCurrency } from '../../../../lib/utils';", "import { formatCurrency } from '../../../../lib/utils';\nimport { getAdminSupplierSnapshot } from '../../../../lib/supplierOperations';");
s=s.replace(/const \{ count: fCount \} = await supabase\r?\n\s*\.from\('fornecedores'\)\r?\n\s*\.select\('id', \{ count: 'exact', head: true \}\)\r?\n\s*\.eq\('status', 'ativo'\);/,
`const supplierSnapshot = await getAdminSupplierSnapshot();\n      const fCount = supplierSnapshot.suppliers.filter((item) => item.status === 'ativo').length;`);
if(s.includes(".from('fornecedores')")) throw new Error('Leitura direta restante em Pessoas'); fs.writeFileSync(f,s,'utf8');
console.log('SUPPLIER_DIRECT_READS_PATCH_OK');
