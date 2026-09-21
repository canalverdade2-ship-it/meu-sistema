const fs = require('fs');
const path = require('path');

function scanDir(dir, pattern, ext = ['.tsx', '.ts']) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(scanDir(full, pattern, ext));
    } else if (ext.some(e => entry.name.endsWith(e))) {
      const content = fs.readFileSync(full, 'utf8');
      const matches = content.match(pattern);
      if (matches) {
        results.push({ file: full, count: matches.length });
      }
    }
  }
  return results;
}

console.log('=== CHECK 1: Scanning for \\uFFFD in src/components/client/ ===');
const clientDir = path.resolve('src/components/client');
const ufffdMatches = scanDir(clientDir, /\uFFFD/g);
console.log('Matches in src/components/client:', ufffdMatches.length === 0 ? '0 (ALL CLEAN)' : ufffdMatches);

console.log('=== CHECK 2: Scanning for \\uFFFD across entire src/ ===');
const allUfffd = scanDir(path.resolve('src'), /\uFFFD/g);
console.log('Matches in src/:', allUfffd.length === 0 ? '0 (ALL CLEAN)' : allUfffd);

console.log('=== CHECK 3: Scanning for "= inputMode" or "=inputMode" in src/ ===');
const inputModeMatches = scanDir(path.resolve('src'), /=\s*inputMode/g);
console.log('Matches for = inputMode:', inputModeMatches.length === 0 ? '0 (ALL CLEAN)' : inputModeMatches);

console.log('=== CHECK 4: Scanning for "= inputMode=\\"numeric\\">" or similar broken tags in src/ ===');
const brokenTagMatches = scanDir(path.resolve('src'), /inputMode="numeric">/g);
console.log('Matches for inputMode="numeric">:', brokenTagMatches.length === 0 ? '0 (ALL CLEAN)' : brokenTagMatches);

console.log('=== CHECK 5: Checking specific 4 Admin files ===');
const adminFiles = [
  'src/components/admin/FornecedoresModule.tsx',
  'src/components/admin/ServicePackagesModule.tsx',
  'src/components/admin/ConfiguracoesModule.tsx',
  'src/components/admin/AffiliateAdminModule.tsx'
];
for (const af of adminFiles) {
  const full = path.resolve(af);
  if (!fs.existsSync(full)) {
    console.log(af, ': FILE NOT FOUND');
    continue;
  }
  const content = fs.readFileSync(full, 'utf8');
  const ufffd = (content.match(/\uFFFD/g) || []).length;
  const badInput = (content.match(/=\s*inputMode/g) || []).length;
  console.log(af, `-> uFFFD: ${ufffd}, badInputMode: ${badInput}`);
}

console.log('=== CHECK 6: Checking ClientFinanceiro ticket query strings ===');
const finPath = path.resolve('src/components/client/ClientFinanceiro.tsx');
const finContent = fs.readFileSync(finPath, 'utf8');
const exactQuery1 = finContent.includes("Solicitação de Liberação Manual de Saque");
const exactQuery2 = finContent.includes("Solicitação de Saque Abaixo do Mínimo");
console.log('Query 1 ("Solicitação de Liberação Manual de Saque"):', exactQuery1 ? 'FOUND' : 'MISSING');
console.log('Query 2 ("Solicitação de Saque Abaixo do Mínimo"):', exactQuery2 ? 'FOUND' : 'MISSING');

console.log('=== CHECK 7: Checking 7 specific client files from Worker 1 ===');
const clientFiles = [
  'src/components/client/ClientAssinaturas.tsx',
  'src/components/client/ClientFinanceiro.tsx',
  'src/components/client/ClientProdutos.tsx',
  'src/components/client/ClientServicos.tsx',
  'src/components/client/ClientSuporte.tsx',
  'src/components/client/ClientVouchers.tsx',
  'src/components/client/financeiro/PaymentModal.tsx'
];
for (const cf of clientFiles) {
  const full = path.resolve(cf);
  const content = fs.readFileSync(full, 'utf8');
  const ufffd = (content.match(/\uFFFD/g) || []).length;
  console.log(cf, `-> uFFFD: ${ufffd}`);
}
