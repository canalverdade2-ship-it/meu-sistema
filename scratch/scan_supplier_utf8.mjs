import fs from 'node:fs';
const files = [
  'src/pages/Fornecedor/FornecedorAccessPage.tsx',
  'src/pages/Fornecedor/FornecedorDashboard.tsx',
  'src/pages/Fornecedor/FornecedorLandingPage.tsx',
  'src/components/admin/FornecedoresModule.tsx',
  'src/lib/supplierOperations.ts',
  'src/types/supplier.ts',
];
let bad = 0;
for (const f of files) {
  const b = fs.readFileSync(f);
  const s = new TextDecoder('utf-8', { fatal: true }).decode(b);
  const replacement = s.includes('\uFFFD');
  const mojibake = ['Ã', 'Â', 'ðŸ', 'â€œ', 'â€', 'âœ'].some(x => s.includes(x));
  console.log(`${f}|replacement=${replacement}|mojibake=${mojibake}`);
  if (replacement || mojibake) bad++;
}
console.log(`SUPPLIER_UTF8_BAD=${bad}`);
process.exitCode = bad ? 1 : 0;