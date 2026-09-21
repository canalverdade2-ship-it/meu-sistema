import fs from 'node:fs';
const root = 'C:/Users/Adriano Farias/Downloads/remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)/src';
function patch(path, changes) {
  const original = fs.readFileSync(path, 'utf8'); const crlf = original.includes('\r\n'); let text = original.replace(/\r\n/g,'\n');
  for (const [a,b,label] of changes) { const n=text.split(a).length-1; if(n!==1) throw new Error(`${label}: ${n}`); text=text.replace(a,b); }
  fs.writeFileSync(path, crlf ? text.replace(/\n/g,'\r\n') : text, 'utf8');
}
patch(`${root}/types.ts`, [[
  "  status: 'aberto' | 'em andamento' | 'concluido';",
  "  status: 'aberto' | 'em andamento' | 'concluido' | 'cancelado';",
  'client ticket type'
]]);
const adminPath = `${root}/components/admin/super-domains/contratos/AtendimentoTicketsView.tsx`;patch(adminPath, [
  ["    if (!replyMessage.trim() || !selectedTicket) return;",
   "    if (!replyMessage.trim() || !selectedTicket) return;\n    if (selectedTicket.status === 'cancelado') { toast.error('Este ticket foi cancelado pelo cliente e está somente para consulta.'); return; }",
   'admin send guard'],
  ["              <option value=\"resolvido\">Resolvidos</option>",
   "              <option value=\"resolvido\">Resolvidos</option>\n              <option value=\"cancelado\">Cancelados pelo Cliente</option>",
   'admin filter'],
  ["          selectedTicket && selectedTicket.status !== 'resolvido' && (",
   "          selectedTicket && !['resolvido', 'cancelado'].includes(selectedTicket.status) && (",
   'admin resolve guard'],
  ["                    onClick={() => setReplyMessage(cr.text)}",
   "                    onClick={() => setReplyMessage(cr.text)}\n                    disabled={selectedTicket.status === 'cancelado'}",
   'canned disabled'],
  ["                    className=\"whitespace-nowrap px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition\"",
   "                    className=\"whitespace-nowrap px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition disabled:opacity-40 disabled:cursor-not-allowed\"",
   'canned class']
]);patch(adminPath, [
  ["                    value={replyMessage}\n                    onChange={(e) => setReplyMessage(e.target.value)}",
   "                    value={replyMessage}\n                    onChange={(e) => setReplyMessage(e.target.value)}\n                    disabled={selectedTicket.status === 'cancelado'}",
   'reply disabled'],
  ["                    disabled={isSending}",
   "                    disabled={isSending || selectedTicket.status === 'cancelado'}",
   'send disabled'],
  ["              {/* Canned Responses Shortcut */}",
   "              {selectedTicket.status === 'cancelado' && (\n                <div className=\"border-t border-rose-100 bg-rose-50 px-5 py-3 text-xs font-bold text-rose-700\">Ticket cancelado pelo cliente. Conversa disponível somente para consulta.</div>\n              )}\n\n              {/* Canned Responses Shortcut */}",
   'cancel banner']
]);
console.log('TICKET_TYPES_ADMIN_PATCH_OK');