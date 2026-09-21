import fs from 'node:fs';
const path = 'C:/Users/Adriano Farias/Downloads/remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)/src/components/client/ClientMeuCredito.tsx';
const original = fs.readFileSync(path, 'utf8');
const crlf = original.includes('\r\n');
let text = original.replace(/\r\n/g, '\n');
function replaceOnce(oldText, newText, label) {
  const count = text.split(oldText).length - 1;
  if (count !== 1) throw new Error(`${label}: esperado 1, encontrado ${count}`);
  text = text.replace(oldText, newText);
}
replaceOnce(
  "import type { CreditLimitCancellation } from '../../features/creditLimitCancellation/types';",
  "import type { CreditLimitCancellation } from '../../features/creditLimitCancellation/types';\nimport { CreditWithdrawalModal } from './CreditWithdrawalModal';\nimport { listClientCreditWithdrawals } from '../../features/creditWithdrawal/service';\nimport type { CreditWithdrawal } from '../../features/creditWithdrawal/types';",
  'imports',
);
replaceOnce(
  "  const [creditLimitCancellations, setCreditLimitCancellations] = useState<CreditLimitCancellation[]>([]);",
  "  const [creditLimitCancellations, setCreditLimitCancellations] = useState<CreditLimitCancellation[]>([]);\n  const [creditWithdrawals, setCreditWithdrawals] = useState<CreditWithdrawal[]>([]);\n  const [isCreditWithdrawalModalOpen, setIsCreditWithdrawalModalOpen] = useState(false);",
  'states',
);
replaceOnce(
  "      try { setCreditLimitCancellations(await listClientCreditLimitCancellations()); }\n      catch (cancelError) { console.warn('Não foi possível carregar os cancelamentos de limite:', cancelError); setCreditLimitCancellations([]); }",
  "      try { setCreditLimitCancellations(await listClientCreditLimitCancellations()); }\n      catch (cancelError) { console.warn('Não foi possível carregar os cancelamentos de limite:', cancelError); setCreditLimitCancellations([]); }\n      try { setCreditWithdrawals(await listClientCreditWithdrawals()); }\n      catch (withdrawalError) { console.warn('Não foi possível carregar os saques de crédito:', withdrawalError); setCreditWithdrawals([]); }",
  'load withdrawals',
);
replaceOnce(
  "  const getCreditDisputeForMovement = (movementId: string) =>",
  "  const activeCreditWithdrawal = creditWithdrawals.find((item) => ['aguardando_documentos', 'em_analise', 'analise_reforcada', 'aprovado'].includes(item.status)) || null;\n  const notifiedCreditWithdrawal = initialItemId ? creditWithdrawals.find((item) => item.id === initialItemId) || null : null;\n  const creditWithdrawalForModal = notifiedCreditWithdrawal || activeCreditWithdrawal;\n\n  useEffect(() => {\n    if (initialItemId && creditWithdrawals.some((item) => item.id === initialItemId)) setIsCreditWithdrawalModalOpen(true);\n  }, [initialItemId, creditWithdrawals]);\n\n  const getCreditDisputeForMovement = (movementId: string) =>",
  'derived withdrawal',
);
replaceOnce(
  "              {Number(cliente.limite_credito_total || 0) > 0 && (\n                <button type=\"button\" onClick={() => void handleRequestCreditLimitCancellation()}",
  "              {Number(cliente.limite_credito_disponivel || 0) > 0 && (\n                <button type=\"button\" onClick={() => setIsCreditWithdrawalModalOpen(true)} className=\"inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 text-emerald-200 text-xs font-black uppercase tracking-wider transition-all hover:bg-emerald-500/20 whitespace-nowrap\">\n                  {activeCreditWithdrawal ? 'Acompanhar Saque' : 'Solicitar Saque'}\n                  <DollarSign className=\"w-4 h-4\" />\n                </button>\n              )}\n              {Number(cliente.limite_credito_total || 0) > 0 && (\n                <button type=\"button\" onClick={() => void handleRequestCreditLimitCancellation()}",
  'quick action',
);
replaceOnce(
  "      <CreditDisputeModal\n        isOpen={Boolean(selectedDisputeMovement)}",
  "      <CreditWithdrawalModal\n        isOpen={isCreditWithdrawalModalOpen}\n        clientId={clientId}\n        withdrawal={creditWithdrawalForModal}\n        onClose={() => setIsCreditWithdrawalModalOpen(false)}\n        onChanged={async () => { await loadData(); onRefreshCliente(); }}\n      />\n\n      <CreditDisputeModal\n        isOpen={Boolean(selectedDisputeMovement)}",
  'withdrawal modal',
);
const output = crlf ? text.replace(/\n/g, '\r\n') : text;
fs.writeFileSync(path, output, 'utf8');
console.log('PATCH_OK');
