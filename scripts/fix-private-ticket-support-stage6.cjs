const fs = require('fs');
const path = require('path');

function read(file) { return fs.readFileSync(path.join(process.cwd(), file), 'utf8'); }
function write(file, content) { fs.writeFileSync(path.join(process.cwd(), file), content, 'utf8'); }
function replaceOnce(source, search, replacement, label) {
  const count = source.split(search).length - 1;
  if (count !== 1) throw new Error(`${label}: esperado 1 trecho, encontrado ${count}.`);
  return source.replace(search, replacement);
}
function replaceBetween(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0 || end <= start) throw new Error(`${label}: marcadores nao encontrados.`);
  return source.slice(0, start) + replacement.trimEnd() + '\n\n' + source.slice(end);
}

function patchTypes() {
  const file = 'src/types.ts';
  let source = read(file);
  source = replaceOnce(
    source,
    `  anexos_os?: { nome: string; url: string }[];`,
    `  anexos_os?: { nome: string; url: string; mime_type?: string; size?: number }[];`,
    'Metadados dos anexos da OS',
  );
  source = replaceOnce(
    source,
    `  anexo_tipo?: string;\n  data_envio: string;`,
    `  anexo_tipo?: string;\n  anexo_nome?: string;\n  data_envio: string;`,
    'Nome do anexo do ticket',
  );
  write(file, source);
}

function patchClientSupport() {
  const file = 'src/components/client/ClientSuporte.tsx';
  let source = read(file);

  source = replaceOnce(
    source,
    `import { clientOperationalWrite } from '../../lib/clientOperationalWrite';\n`,
    `import { clientOperationalWrite } from '../../lib/clientOperationalWrite';\nimport { removePrivateDocument, uploadPrivateDocument } from '../../lib/privateStorage';\nimport { SecureAttachmentButton } from '../ui/SecureAttachmentButton';\n`,
    'Imports privados do suporte do cliente',
  );

  source = replaceBetween(
    source,
    '  const handleSendMessage = async () => {',
    '  const [isSubmitting, setIsSubmitting] = useState(false);',
    `  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !attachment) || !selectedTicket || isSendingMessage) return;

    setIsSendingMessage(true);
    let uploadedReference: string | null = null;
    let messagePersisted = false;

    try {
      const { data: cliente } = await supabase.from('clientes').select('nome').eq('id', clientId).single();

      let anexoUrl = '';
      let anexoTipo = '';
      let anexoNome = '';

      if (attachment) {
        const uploaded = await uploadPrivateDocument(attachment, {
          scope: 'clientes',
          ownerId: clientId,
          context: 'tickets',
          contextId: selectedTicket.id,
        });
        uploadedReference = uploaded.reference;
        anexoUrl = uploaded.reference;
        anexoTipo = uploaded.mimeType;
        anexoNome = uploaded.fileName;
      }

      const tempMessage: TicketMensagem = {
        id: Date.now().toString(),
        ticket_id: selectedTicket.id,
        autor_id: clientId,
        autor_nome: cliente?.nome || 'Cliente',
        mensagem: newMessage,
        anexo_url: anexoUrl || undefined,
        anexo_tipo: anexoTipo || undefined,
        anexo_nome: anexoNome || undefined,
        data_envio: new Date().toISOString(),
        tipo: 'cliente',
      };

      setMessages(prev => [...prev, tempMessage]);
      setNewMessage('');
      setAttachment(null);

      try {
        await clientOperationalWrite(clientId, 'ticket_mensagens', 'insert', {
          ticket_id: selectedTicket.id,
          autor_id: clientId,
          autor_nome: cliente?.nome || 'Cliente',
          mensagem: newMessage,
          anexo_url: anexoUrl || null,
          anexo_tipo: anexoTipo || null,
          anexo_nome: anexoNome || null,
          tipo: 'cliente',
        });
        messagePersisted = true;
      } catch (error) {
        setMessages(prev => prev.filter(message => message.id !== tempMessage.id));
        throw error;
      }

      const adminTab = selectedTicket.status === 'aberto' ? 'abertos' : 'em_andamento';
      await notificationService.notifyAdmin(
        '💬 Nova Mensagem no Suporte',
        \`O cliente \${cliente?.nome || clientId} enviou uma mensagem no ticket #\${selectedTicket.id.slice(0, 8)}.\`,
        'suporte',
        'ticket_mensagem_cliente',
        { itemId: selectedTicket.id, tab: adminTab },
      );
    } catch (error) {
      if (!messagePersisted && uploadedReference) {
        await removePrivateDocument(uploadedReference).catch(() => undefined);
      }
      console.error('Erro ao enviar mensagem:', error);
      toast.error('Erro ao enviar mensagem.');
    } finally {
      setIsSendingMessage(false);
    }
  };`,
    'Envio privado no suporte do cliente',
  );

  source = replaceOnce(
    source,
    `                      {msg.anexo_url && (
                        <div className="mb-2">
                          {msg.anexo_tipo?.startsWith('image/') ? (
                            <a href={msg.anexo_url} target="_blank" rel="noopener noreferrer">
                              <img src={msg.anexo_url} alt="Anexo" className="rounded-lg max-h-48 object-cover mb-2 ring-1 ring-black/10" />
                            </a>
                          ) : (
                            <a href={msg.anexo_url} target="_blank" rel="noopener noreferrer" className={\`flex items-center gap-2 p-2 rounded-lg text-xs font-bold transition-all \${msg.tipo === 'cliente' ? 'bg-black/10 hover:bg-black/20 text-white' : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'}\`}>
                              <FileIcon className="h-4 w-4" />
                              Baixar Anexo
                              <Download className="h-3 w-3 ml-auto opacity-50" />
                            </a>
                          )}
                        </div>
                      )}`,
    `                      {msg.anexo_url && (
                        <div className="mb-2">
                          <SecureAttachmentButton
                            reference={msg.anexo_url}
                            fileName={msg.anexo_nome || 'Anexo do suporte'}
                            mimeType={msg.anexo_tipo}
                            className={msg.tipo === 'cliente'
                              ? 'bg-black/10 text-white hover:bg-black/20'
                              : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'}
                          />
                        </div>
                      )}`,
    'Abertura segura no suporte do cliente',
  );

  write(file, source);
}

function patchAdminTickets() {
  const file = 'src/components/admin/TicketsModule.tsx';
  let source = read(file);

  source = replaceOnce(
    source,
    `import { whatsappNotificationService } from '../../lib/whatsappNotificationService';\n`,
    `import { whatsappNotificationService } from '../../lib/whatsappNotificationService';\nimport { removePrivateDocument, uploadPrivateDocument } from '../../lib/privateStorage';\nimport { SecureAttachmentButton } from '../ui/SecureAttachmentButton';\n`,
    'Imports privados dos tickets administrativos',
  );

  source = replaceBetween(
    source,
    '  const handleSendMessage = async () => {',
    '  const handleUpdateStatus = async (id: string, status: string) => {',
    `  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !attachment) || !selectedTicket) return;

    let uploadedReference: string | null = null;
    let messagePersisted = false;

    try {
      let anexoUrl = '';
      let anexoTipo = '';
      let anexoNome = '';

      if (attachment) {
        const ownerId = selectedTicket.prestador_id || selectedTicket.cliente_id;
        if (!ownerId) throw new Error('O ticket não possui um destinatário válido.');

        const uploaded = await uploadPrivateDocument(attachment, {
          scope: selectedTicket.prestador_id ? 'prestadores' : 'clientes',
          ownerId,
          context: 'tickets',
          contextId: selectedTicket.id,
        });
        uploadedReference = uploaded.reference;
        anexoUrl = uploaded.reference;
        anexoTipo = uploaded.mimeType;
        anexoNome = uploaded.fileName;
      }

      const tempMessage: TicketMensagem = {
        id: Date.now().toString(),
        ticket_id: selectedTicket.id,
        autor_id: colaboradorId || 'admin',
        autor_nome: colaboradorNome || 'Suporte GSA',
        mensagem: newMessage,
        anexo_url: anexoUrl || undefined,
        anexo_tipo: anexoTipo || undefined,
        anexo_nome: anexoNome || undefined,
        data_envio: new Date().toISOString(),
        tipo: 'admin',
      };

      setMessages(prev => [...prev, tempMessage]);
      setNewMessage('');
      setAttachment(null);

      const { error } = await supabase.from('ticket_mensagens').insert([{
        ticket_id: selectedTicket.id,
        autor_id: colaboradorId || 'admin',
        autor_nome: colaboradorNome || 'Suporte GSA',
        mensagem: newMessage,
        anexo_url: anexoUrl || null,
        anexo_tipo: anexoTipo || null,
        anexo_nome: anexoNome || null,
        tipo: 'admin',
      }]);
      if (error) {
        setMessages(prev => prev.filter(message => message.id !== tempMessage.id));
        throw error;
      }
      messagePersisted = true;

      if (selectedTicket.cliente_id) {
        await notificationService.notifyClient(
          selectedTicket.cliente_id,
          '💬 Nova Mensagem no Suporte',
          \`Você recebeu uma nova mensagem no ticket: \${selectedTicket.assunto}\`,
          'suporte',
          'ticket_respondido',
          { itemId: selectedTicket.id, prioridade: 'alta', contexto: { ticket_id: selectedTicket.id, assunto: selectedTicket.assunto } },
        );
      } else if (selectedTicket.prestador_id) {
        await createNotification(
          selectedTicket.prestador_id,
          'Suporte GSA',
          \`Nova mensagem no ticket: \${selectedTicket.assunto}\`,
          'suporte',
          'mensagens',
          selectedTicket.id,
        );
      }

      await logService.logAction({
        acao: 'RESPONDER_TICKET',
        ator_tipo: colaboradorNome ? 'colaborador' : 'admin',
        ator_id: colaboradorId || undefined,
        ator_nome: colaboradorNome || 'Administrador',
        detalhes: \`Respondendo ticket #\${selectedTicket.id.slice(0, 8)} - \${selectedTicket.assunto}\`,
      });
    } catch (error: any) {
      if (!messagePersisted && uploadedReference) {
        await removePrivateDocument(uploadedReference).catch(() => undefined);
      }
      console.error('Erro detalhado ao enviar mensagem:', error);
      toast.error(error?.message || 'Erro ao enviar mensagem.');
    }
  };`,
    'Envio privado dos tickets administrativos',
  );

  source = replaceOnce(
    source,
    `                         {msg.anexo_url && (
                           <div className="mb-2">
                             {msg.anexo_tipo?.startsWith('image/') ? (
                               <a href={msg.anexo_url} target="_blank" rel="noopener noreferrer">
                                 <img src={msg.anexo_url} alt="Anexo" className="rounded-lg max-h-48 object-cover mb-2 ring-1 ring-black/10" />
                               </a>
                             ) : (
                               <a href={msg.anexo_url} target="_blank" rel="noopener noreferrer" className={\`flex items-center gap-2 p-2 rounded-lg text-xs font-bold transition-all \${msg.tipo === 'admin' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'}\`}>
                                 <FileIcon className="h-4 w-4" />
                                 Baixar Anexo
                                 <Download className="h-3 w-3 ml-auto opacity-50" />
                               </a>
                             )}
                           </div>
                         )}`,
    `                         {msg.anexo_url && (
                           <div className="mb-2">
                             <SecureAttachmentButton
                               reference={msg.anexo_url}
                               fileName={msg.anexo_nome || 'Anexo do suporte'}
                               mimeType={msg.anexo_tipo}
                               className={msg.tipo === 'admin'
                                 ? 'bg-white/10 text-white hover:bg-white/20'
                                 : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'}
                             />
                           </div>
                         )}`,
    'Abertura segura dos tickets administrativos',
  );

  write(file, source);
}

function patchProviderSupport() {
  const file = 'src/components/prestador/PrestadorSuporte.tsx';
  let source = read(file);

  source = replaceOnce(
    source,
    `import { useAutoFitTabs } from '../../hooks/useAutoFitTabs';\n`,
    `import { useAutoFitTabs } from '../../hooks/useAutoFitTabs';\nimport { removePrivateDocument, uploadPrivateDocument } from '../../lib/privateStorage';\nimport { SecureAttachmentButton } from '../ui/SecureAttachmentButton';\n`,
    'Imports privados do suporte do prestador',
  );

  source = replaceBetween(
    source,
    '  const handleSendMessage = async () => {',
    '  const handleCreate = async (formData: any) => {',
    `  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !attachment) || !selectedTicket || isSubmitting) return;

    setIsSubmitting(true);
    let uploadedReference: string | null = null;
    let messagePersisted = false;

    try {
      const { data: prestador } = await supabase.from('prestadores').select('nome_razao').eq('id', prestadorId).single();

      let anexoUrl = '';
      let anexoTipo = '';
      let anexoNome = '';

      if (attachment) {
        const uploaded = await uploadPrivateDocument(attachment, {
          scope: 'prestadores',
          ownerId: prestadorId,
          context: 'tickets',
          contextId: selectedTicket.id,
        });
        uploadedReference = uploaded.reference;
        anexoUrl = uploaded.reference;
        anexoTipo = uploaded.mimeType;
        anexoNome = uploaded.fileName;
      }

      const tempMessage: TicketMensagem = {
        id: Date.now().toString(),
        ticket_id: selectedTicket.id,
        autor_id: prestadorId,
        autor_nome: prestador?.nome_razao || 'Prestador',
        mensagem: newMessage,
        anexo_url: anexoUrl || undefined,
        anexo_tipo: anexoTipo || undefined,
        anexo_nome: anexoNome || undefined,
        data_envio: new Date().toISOString(),
        tipo: 'prestador',
      };

      setMessages(prev => [...prev, tempMessage]);
      setNewMessage('');
      setAttachment(null);

      const { error } = await supabase.from('ticket_mensagens').insert([{
        ticket_id: selectedTicket.id,
        autor_id: prestadorId,
        autor_nome: prestador?.nome_razao || 'Prestador',
        mensagem: newMessage,
        anexo_url: anexoUrl || null,
        anexo_tipo: anexoTipo || null,
        anexo_nome: anexoNome || null,
        tipo: 'prestador',
      }]);
      if (error) {
        setMessages(prev => prev.filter(message => message.id !== tempMessage.id));
        throw error;
      }
      messagePersisted = true;

      const adminTab = selectedTicket.status === 'aberto' ? 'abertos' : 'em andamento';
      await notificationService.notifyAdmin(
        'Nova Mensagem (Prestador)',
        \`O prestador \${prestador?.nome_razao || prestadorId} enviou uma mensagem no ticket #\${selectedTicket.id.slice(0, 8)}.\`,
        'suporte',
        'ticket_mensagem_recebida',
        { tab: adminTab, itemId: selectedTicket.id, contexto: { prestador_id: prestadorId, ticket_id: selectedTicket.id } },
      );
    } catch (error) {
      if (!messagePersisted && uploadedReference) {
        await removePrivateDocument(uploadedReference).catch(() => undefined);
      }
      console.error('Erro ao enviar mensagem:', error);
      toast.error('Erro ao enviar mensagem.');
    } finally {
      setIsSubmitting(false);
    }
  };`,
    'Envio privado do suporte do prestador',
  );

  source = replaceOnce(
    source,
    `                        {msg.anexo_url && (
                          <div className="mb-2">
                            {msg.anexo_tipo?.startsWith('image/') ? (
                              <a href={msg.anexo_url} target="_blank" rel="noopener noreferrer">
                                <img src={msg.anexo_url} alt="Anexo" className="rounded-lg max-h-48 object-cover mb-2 ring-1 ring-black/10" />
                              </a>
                            ) : (
                              <a href={msg.anexo_url} target="_blank" rel="noopener noreferrer" className={\`flex items-center gap-2 p-2 rounded-lg text-xs font-bold transition-all \${msg.tipo === 'prestador' ? 'bg-black/10 hover:bg-black/20 text-white' : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'}\`}>
                                <FileIcon className="h-4 w-4" />
                                Baixar Anexo
                                <Download className="h-3 w-3 ml-auto opacity-50" />
                              </a>
                            )}
                          </div>
                        )}`,
    `                        {msg.anexo_url && (
                          <div className="mb-2">
                            <SecureAttachmentButton
                              reference={msg.anexo_url}
                              fileName={msg.anexo_nome || 'Anexo do suporte'}
                              mimeType={msg.anexo_tipo}
                              className={msg.tipo === 'prestador'
                                ? 'bg-black/10 text-white hover:bg-black/20'
                                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'}
                            />
                          </div>
                        )}`,
    'Abertura segura do suporte do prestador',
  );

  write(file, source);
}

patchTypes();
patchClientSupport();
patchAdminTickets();
patchProviderSupport();
console.log('Tickets de cliente, administrador e prestador atualizados para armazenamento privado.');
