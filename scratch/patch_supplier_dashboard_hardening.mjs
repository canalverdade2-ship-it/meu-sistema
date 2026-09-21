import fs from 'node:fs';
const file = 'src/pages/Fornecedor/FornecedorDashboard.tsx';
let s = fs.readFileSync(file, 'utf8');
const must = (re, replacement, label) => {
  const before = s;
  s = s.replace(re, replacement);
  if (s === before) throw new Error(`Patch ausente: ${label}`);
};
must(
  /<Payables supplierId=\{snapshot\.supplier\.id\} payables=\{snapshot\.payables\} loading=\{loading\} \/>/,
  '<Payables supplier={snapshot.supplier} payables={snapshot.payables} loading={loading} />',
  'payables-props',
);
must(
  /function Payables\(\{ supplierId, payables, loading \}: \{ supplierId: string; payables: Array<Record<string, any>>; loading: boolean \}\)/,
  'function Payables({ supplier, payables, loading }: { supplier: Record<string, any>; payables: Array<Record<string, any>>; loading: boolean })',
  'payables-signature',
);
must(
  /\s*const \{ data: sData \} = await supabase\.from\('fornecedores'\)\.select\('nome_fantasia, razao_social, telefone'\)\.eq\('id', supplierId\)\.single\(\);\s*if \(!sData\?\.telefone\) \{ toast\.error\("Telefone não encontrado\."\); return; \}\s*const supplierName = sData\.nome_fantasia \|\| sData\.razao_social \|\| 'Fornecedor';/,
  `\n              const phone = String(supplier?.telefone || '');\n              if (!phone) { toast.error("Telefone não encontrado."); return; }\n              const supplierName = supplier?.nome_fantasia || supplier?.razao_social || 'Fornecedor';`,
  'payables-direct-read',
);
s = s.replace('await sendToWhatsApp(sData.telefone, msg, pdfBase64,', 'await sendToWhatsApp(phone, msg, pdfBase64,');
fs.writeFileSync(file, s, 'utf8');
console.log('SUPPLIER_DASHBOARD_BASE_PATCH_OK');
