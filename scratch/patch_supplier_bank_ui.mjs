import fs from 'node:fs';
const file = 'src/pages/Fornecedor/FornecedorDashboard.tsx';
let s = fs.readFileSync(file, 'utf8');
const rep = (re, value, label) => { const b = s; s = s.replace(re, value); if (s === b) throw new Error(`Patch ausente: ${label}`); };
rep(/await updateSupplierProfile\(payload\);\r?\n\s*toast\.success\('Perfil e dados de pagamento atualizados\.'\);/,
`const result = await updateSupplierProfile(payload);\n                  toast.success(result?.bank_change_pending\n                    ? 'Perfil atualizado. Alterações bancárias aguardam análise do sistema.'\n                    : 'Perfil atualizado.');`, 'profile-toast');
rep(/function Profile\(\{ supplier, saving, onSave \}: \{[\s\S]*?\}\) \{\r?\n  const bank = supplier\?\.dados_bancarios \|\| \{\};/,
(match) => match + "\n  const pendingBank = supplier?.dados_bancarios_pendentes || null;", 'pending-bank-var');
rep(/<h2 className="font-black">Dados bancários e PIX<\/h2>\r?\n\s*<p className="mt-1 text-xs text-neutral-500">Os pagamentos só devem ser feitos para os dados registrados neste perfil\.<\/p>/,
`<h2 className="font-black">Dados bancários e PIX</h2>\n          <p className="mt-1 text-xs text-neutral-500">Os pagamentos só devem ser feitos para dados aprovados pelo sistema.</p>\n          {pendingBank && (\n            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">\n              Existe uma alteração bancária aguardando análise. Até a aprovação, os dados anteriores continuam válidos para pagamento.\n            </div>\n          )}`, 'pending-bank-banner');
fs.writeFileSync(file, s, 'utf8');
console.log('SUPPLIER_BANK_UI_PATCH_OK');
