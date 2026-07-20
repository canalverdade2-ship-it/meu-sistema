const fs = require('fs');
const path = require('path');

const root = process.cwd();

function removeRange(content, startMarker, endMarker) {
  const start = content.indexOf(startMarker);
  if (start === -1) {
    throw new Error(`Start marker not found: ${startMarker}`);
  }
  const end = content.indexOf(endMarker, start);
  if (end === -1) {
    throw new Error(`End marker not found after ${startMarker}: ${endMarker}`);
  }
  return content.slice(0, start) + content.slice(end);
}

function updateFile(relativePath, removals) {
  const filePath = path.join(root, relativePath);
  let content = fs.readFileSync(filePath, 'utf8');
  for (const [startMarker, endMarker] of removals) {
    content = removeRange(content, startMarker, endMarker);
  }
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Cleaned ${relativePath}`);
}

updateFile('src/components/admin/FinanceiroModule.tsx', [
  ['  const legacyConfirmAprovarSaque = async () => {', '  const handleRejeitarSaque = async (saque: Saque) => {'],
  ['  const legacyConfirmRejeitarSaque = async () => {', '  const handleAprovarTransferencia = (t: any) => {'],
  ['  const legacyConfirmAprovarTransferencia = async () => {', '  const confirmRejeitarTransferencia = async () => {'],
  ['  const legacyConfirmRejeitarTransferencia = async () => {', '  const confirmEstornarTransferencia = async () => {'],
  ['  const legacyConfirmEstornarTransferencia = async () => {', '  const handleManualPayment = async (fatura: Fatura, method: string, dateTime: string, notes: string) => {'],
]);

updateFile('src/components/admin/Dashboard.tsx', [
  ['  const legacyHandleApproveSaque = async (id: string) => {', '  /* '],
]);
