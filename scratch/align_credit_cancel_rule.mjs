import fs from 'node:fs';
const file = String.raw`C:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\src\components\client\ClientMeuCredito.tsx`;
let text = fs.readFileSync(file, 'utf8');
const addOnce = (anchor, addition, label) => {
  const count = text.split(anchor).length - 1;
  if (count !== 1) throw new Error(`${label}: ${count}`);
  text = text.replace(anchor, `${anchor}\r\n${addition}`);
};
addOnce(
  `  const currentCreditUsed = Math.max(Number(cliente.limite_credito_total || 0) - Number(cliente.limite_credito_disponivel || 0), 0);`,
  `  const hasPendingCreditInvoice = faturas.some((fat) => fat.status !== 'cancelado' && Number(fat.valor_final_pendente || 0) > 0.01);`,
  'currentCreditUsed',
);
addOnce(
  `    if (currentCreditUsed > 0.01) { toast.error('O limite só pode ser cancelado quando não houver nenhum valor utilizado.'); return; }`,
  `    if (hasPendingCreditInvoice) { toast.error('Quite ou regularize as faturas de crédito pendentes antes de solicitar o cancelamento.'); return; }`,
  'handler',
);
fs.writeFileSync(file, text, 'utf8');
console.log('CLIENT_CANCELLATION_RULE_ALIGNED');