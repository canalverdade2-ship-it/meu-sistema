const fs = require('fs');
const path = require('path');

const root = process.cwd();

function removeRange(content, startMarker, endMarker) {
  const start = content.indexOf(startMarker);
  if (start === -1) throw new Error(`Start marker not found: ${startMarker}`);
  const end = content.indexOf(endMarker, start);
  if (end === -1) throw new Error(`End marker not found after ${startMarker}: ${endMarker}`);
  return content.slice(0, start) + content.slice(end);
}

const filePath = path.join(root, 'src/components/admin/FinanceiroModule.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = removeRange(
  content,
  '  const legacyHandleEnviarParaCobranca = async (fatura: Fatura) => {',
  '  const handleCancelFatura = async (fatura: Fatura, reason: string) => {'
);

content = removeRange(
  content,
  '  const legacyHandleCancelFatura = async (fatura: Fatura, reason: string) => {',
  '  const openCreateModal = async () => {'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Cleaned src/components/admin/FinanceiroModule.tsx');
