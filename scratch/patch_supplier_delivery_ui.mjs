import fs from 'node:fs';
const file = 'src/pages/Fornecedor/FornecedorDashboard.tsx';
let s = fs.readFileSync(file, 'utf8');
const rep = (re, value, label) => {
  const before = s;
  s = s.replace(re, value);
  if (s === before) throw new Error(`Patch ausente: ${label}`);
};
rep(/  const total = Number\(form\.valor_total_nota\);/, "  const total = Math.round(items.reduce((sum, item) => sum + (Number(item.quantidade_entregue || 0) * Number(item.custo_unitario_nota || 0)), 0) * 100) / 100;", 'calculated-total');
rep(/\s*&& form\.valor_total_nota\.trim\(\) !== ''\r?\n\s*&& Number\.isFinite\(total\)\r?\n\s*&& total >= 0/, "\n    && Number.isFinite(total)\n    && total >= 0", 'valid-total');
rep(/<Field label="Valor total da nota" type="number" value=\{form\.valor_total_nota\} onChange=\{\(value\) => setForm\(\{ \.\.\.form, valor_total_nota: value \}\)\} \/>/,
  '<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"><p className="text-[10px] font-black uppercase text-emerald-700">Total conciliado com o pedido</p><p className="mt-1 text-lg font-black text-emerald-900">{formatCurrency(total)}</p></div>', 'total-field');
rep(/<input type="number" min="0" step="0\.01" value=\{item\.custo_unitario_nota\} onChange=\{\(event\) => setItems\(\(current\) => current\.map\(\(entry, itemIndex\) => itemIndex === index \? \{ \.\.\.entry, custo_unitario_nota: event\.target\.value \} : entry\)\)\} className="rounded-lg border border-neutral-200 p-2" \/>/,
  '<div className="rounded-lg border border-neutral-200 bg-white p-2 text-right text-sm font-black">{formatCurrency(Number(item.custo_unitario_nota || 0))}</div>', 'locked-unit-cost');
fs.writeFileSync(file, s, 'utf8');
console.log('SUPPLIER_DELIVERY_UI_PATCH_OK');
