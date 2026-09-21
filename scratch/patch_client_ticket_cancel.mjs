import fs from 'node:fs';
const path = 'C:/Users/Adriano Farias/Downloads/remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)/src/components/client/ClientSuporte.tsx';
const original = fs.readFileSync(path, 'utf8');
const crlf = original.includes('\r\n');
let text = original.replace(/\r\n/g, '\n');
function rep(a,b,label){const n=text.split(a).length-1;if(n!==1)throw new Error(`${label}: ${n}`);text=text.replace(a,b);}
rep("import { MessageSquare, Plus, Clock, CheckCircle, Send, Paperclip, X, File as FileIcon, Image as ImageIcon, Download } from 'lucide-react';",
"import { MessageSquare, Plus, Clock, CheckCircle, Send, Paperclip, X, XCircle, File as FileIcon, Image as ImageIcon, Download } from 'lucide-react';",'icon');
rep("import { SecureAttachmentButton } from '../ui/SecureAttachmentButton';",
"import { SecureAttachmentButton } from '../ui/SecureAttachmentButton';\nimport { callClientRpc } from '../../lib/clientRpc';",'rpc import');
rep("  const [isSendingMessage, setIsSendingMessage] = useState(false);",
"  const [isSendingMessage, setIsSendingMessage] = useState(false);\n  const [isCancellingTicket, setIsCancellingTicket] = useState(false);",'state');rep("        if (item.status === 'aberto' || item.status === 'em andamento') setActiveTab('aberto');\n        else if (item.status === 'concluido') setActiveTab('concluido');",
"        if (item.status === 'aberto' || item.status === 'em andamento') setActiveTab('aberto');\n        else if (item.status === 'concluido' || item.status === 'cancelado') setActiveTab('concluido');",'initial tab');
rep("    } else {\n      query = query.eq('status', activeTab);\n    }",
"    } else {\n      query = query.in('status', ['concluido', 'cancelado']);\n    }",'history query');
rep("    if ((!newMessage.trim() && !attachment) || !selectedTicket || isSendingMessage) return;",
"    if ((!newMessage.trim() && !attachment) || !selectedTicket || isSendingMessage) return;\n    if (!['aberto', 'em andamento'].includes(selectedTicket.status)) {\n      toast.error('Este ticket já está encerrado.');\n      return;\n    }",'send guard');
rep("  const [isSubmitting, setIsSubmitting] = useState(false);",
"  const handleCancelTicket = async () => {\n    if (!selectedTicket || !['aberto', 'em andamento'].includes(selectedTicket.status) || isCancellingTicket) return;\n    if (!window.confirm('Cancelar este ticket? A conversa será encerrada e ficará disponível apenas para consulta.')) return;\n    setIsCancellingTicket(true);\n    try {\n      const result = await callClientRpc<any>('gsa_client_cancel_support_ticket', { p_ticket_id: selectedTicket.id });\n      setSelectedTicket((current) => current ? ({ ...current, status: 'cancelado', data_fechamento: result?.data_fechamento || new Date().toISOString() } as Ticket) : current);\n      setNewMessage('');\n      setAttachment(null);\n      toast.success(result?.already_cancelled ? 'Este ticket já estava cancelado.' : 'Ticket cancelado com sucesso.');\n      setActiveTab('concluido');\n    } catch (error: any) {\n      toast.error(error?.message || 'Não foi possível cancelar o ticket.');\n    } finally {\n      setIsCancellingTicket(false);\n    }\n  };\n\n  const [isSubmitting, setIsSubmitting] = useState(false);",'cancel handler');rep(" : ticket.status === 'em andamento' ? 'bg-[#0e1b2a] text-[#ddc28d] border border-[#1b2b3f]' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'}`",
" : ticket.status === 'em andamento' ? 'bg-[#0e1b2a] text-[#ddc28d] border border-[#1b2b3f]' : ticket.status === 'cancelado' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'}`",'affiliate status color');
rep(" : ticket.status === 'em andamento' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`",
" : ticket.status === 'em andamento' ? 'bg-indigo-50 text-indigo-600' : ticket.status === 'cancelado' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`",'client icon color');
rep(" : ticket.status === 'em andamento' ? 'bg-[#0e1b2a] text-[#ddc28d] border border-[#1b2b3f]' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'}`",
" : ticket.status === 'em andamento' ? 'bg-[#0e1b2a] text-[#ddc28d] border border-[#1b2b3f]' : ticket.status === 'cancelado' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'}`",'affiliate badge color');
rep(" : ticket.status === 'em andamento' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`",
" : ticket.status === 'em andamento' ? 'bg-indigo-100 text-indigo-700' : ticket.status === 'cancelado' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`",'client badge color');
rep("                  {ticket.status}\n", "                  {ticket.status === 'cancelado' ? 'cancelado por você' : ticket.status}\n",'status label');rep("              <p className={`mt-1 text-xs ${isAffiliate ? 'text-[#69717c]' : 'text-neutral-500'}`}>{selectedTicket.descricao}</p>\n            </div>",
"              <p className={`mt-1 text-xs ${isAffiliate ? 'text-[#69717c]' : 'text-neutral-500'}`}>{selectedTicket.descricao}</p>\n              {['aberto', 'em andamento'].includes(selectedTicket.status) && (\n                <button type=\"button\" onClick={() => void handleCancelTicket()} disabled={isCancellingTicket}\n                  className=\"mt-3 inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 transition hover:bg-rose-100 disabled:opacity-50\">\n                  <XCircle className=\"h-4 w-4\" />\n                  {isCancellingTicket ? 'Cancelando ticket...' : 'Cancelar ticket'}\n                </button>\n              )}\n              {selectedTicket.status === 'cancelado' && <p className=\"mt-3 text-xs font-bold text-rose-700\">Ticket cancelado por você. A conversa permanece disponível somente para consulta.</p>}\n            </div>",'chat cancel button');
rep("            {selectedTicket.status !== 'concluido' ? (",
"            {['aberto', 'em andamento'].includes(selectedTicket.status) ? (",'chat editable condition');
rep("              <p className=\"text-center text-sm font-bold text-neutral-400 py-4\">Este ticket foi encerrado.</p>",
"              <p className=\"text-center text-sm font-bold text-neutral-400 py-4\">{selectedTicket.status === 'cancelado' ? 'Este ticket foi cancelado por você.' : 'Este ticket foi encerrado.'}</p>",'closed text');
const output = crlf ? text.replace(/\n/g,'\r\n') : text;
fs.writeFileSync(path, output, 'utf8');
console.log('CLIENT_TICKET_CANCEL_PATCH_OK');