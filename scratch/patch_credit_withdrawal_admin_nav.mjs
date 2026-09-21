import fs from 'node:fs';
const root = 'C:/Users/Adriano Farias/Downloads/remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)';
function patch(path, edits) {
  const original = fs.readFileSync(path, 'utf8');
  const crlf = original.includes('\r\n');
  let text = original.replace(/\r\n/g, '\n');
  for (const [oldText, newText, label] of edits) {
    const count = text.split(oldText).length - 1;
    if (count !== 1) throw new Error(`${label}: esperado 1, encontrado ${count}`);
    text = text.replace(oldText, newText);
  }
  fs.writeFileSync(path, crlf ? text.replace(/\n/g, '\r\n') : text, 'utf8');
}
const view = `${root}/src/components/admin/super-domains/financeiro/EmprestimosCreditoView.tsx`;
patch(view, [
  ["import { CreditLimitCancellationsAdminPanel } from './CreditLimitCancellationsAdminPanel';", "import { CreditLimitCancellationsAdminPanel } from './CreditLimitCancellationsAdminPanel';\nimport { CreditWithdrawalsAdminPanel } from './CreditWithdrawalsAdminPanel';", 'import'],
  ["initialSubTab?: 'emprestimos' | 'credito' | 'contestacoes' | 'cancelamentos_limite';", "initialSubTab?: 'emprestimos' | 'credito' | 'contestacoes' | 'cancelamentos_limite' | 'saques_credito';", 'prop union'],
  ["const [activeTab, setActiveTab] = useState<'emprestimos' | 'credito' | 'contestacoes' | 'cancelamentos_limite'>(initialSubTab);", "const [activeTab, setActiveTab] = useState<'emprestimos' | 'credito' | 'contestacoes' | 'cancelamentos_limite' | 'saques_credito'>(initialSubTab);", 'state union'],
  ["          <button\n            onClick={() => setActiveTab('cancelamentos_limite')}", "          <button\n            onClick={() => setActiveTab('saques_credito')}\n            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${\n              activeTab === 'saques_credito' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'\n            }`}\n          >\n            <DollarSign className=\"h-3.5 w-3.5 text-indigo-600\" />\n            <span>Saques de Crédito</span>\n          </button>\n\n          <button\n            onClick={() => setActiveTab('cancelamentos_limite')}", 'tab button'],
  ["      {activeTab === 'cancelamentos_limite' ? (\n        <CreditLimitCancellationsAdminPanel initialItemId={initialItemId} />", "      {activeTab === 'saques_credito' ? (\n        <CreditWithdrawalsAdminPanel initialItemId={initialItemId} />\n      ) : activeTab === 'cancelamentos_limite' ? (\n        <CreditLimitCancellationsAdminPanel initialItemId={initialItemId} />", 'active panel'],
]);
const domain = `${root}/src/components/admin/super-domains/financeiro/FinanceiroSuperDomain.tsx`;
patch(domain, [
  ["if (['emprestimos_credito', 'emprestimos', 'credito', 'contestacoes', 'cancelamentos_limite'].includes(tab)) return 'emprestimos_credito';", "if (['emprestimos_credito', 'emprestimos', 'credito', 'contestacoes', 'cancelamentos_limite', 'saques_credito'].includes(tab)) return 'emprestimos_credito';", 'normalize'],
  ["initialSubTab={(initialTab === 'contestacoes' ? 'contestacoes' : initialTab === 'cancelamentos_limite' ? 'cancelamentos_limite' : initialSubTab) as any}", "initialSubTab={(initialTab === 'contestacoes' ? 'contestacoes' : initialTab === 'cancelamentos_limite' ? 'cancelamentos_limite' : initialTab === 'saques_credito' ? 'saques_credito' : initialSubTab) as any}", 'subtab route'],
]);
console.log('ADMIN_NAV_PATCH_OK');
