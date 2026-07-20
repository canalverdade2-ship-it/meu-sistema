import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Ticket, TicketMensagem } from '../../types';
import { formatDateTime } from '../../lib/utils';
import { MessageSquare, Plus, Clock, CheckCircle, Send, Paperclip, X, File as FileIcon, Image as ImageIcon, Download } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { toast } from 'react-hot-toast';
import { createNotification } from '../../lib/notifications';
import { notificationService } from '../../lib/notificationService';
import { useAutoFitTabs } from '../../hooks/useAutoFitTabs';
import { clientOperationalWrite } from '../../lib/clientOperationalWrite';
import { removePrivateDocument, uploadPrivateDocument } from '../../lib/privateStorage';
import { SecureAttachmentButton } from '../ui/SecureAttachmentButton';

export function ClientSuporte({ clientId, initialItemId }: { clientId: string, initialItemId?: string }) {
  const { containerRef: suporteTabsRef, setButtonRef: setSuporteTabButtonRef } = useAutoFitTabs(16, 10);
  const [activeTab, setActiveTab] = useState<'aberto' | 'concluido'>('aberto');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [ticketInitialData, setTicketInitialData] = useState<{ assunto?: string, descricao?: string }>({});
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState<TicketMensagem[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const submittingRef = useRef(false);
  const hasAutoOpened = useRef<string | null>(null);

  const [attachment, setAttachment] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);

  useEffect(() => {
    if (initialItemId && tickets.length > 0 && hasAutoOpened.current !== initialItemId) {
      const item = tickets.find(t => t.id === initialItemId);
      if (item) {
        hasAutoOpened.current = initialItemId;
        
        if (item.status === 'aberto' || item.status === 'em andamento') setActiveTab('aberto');
        else if (item.status === 'concluido') setActiveTab('concluido');
        
        setSelectedTicket(item);
        setIsChatOpen(true);
        
        setTimeout(() => {
          const element = document.getElementById(`ticket-${item.id}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHighlightedItemId(item.id);
            setTimeout(() => setHighlightedItemId(null), 3000);
          }
        }, 300);
      }
    }
  }, [initialItemId, tickets.length]);

  useEffect(() => {
    fetchTickets();

    const handleOpenStockTicket = (e: any) => {
      const produto = e.detail?.produto;
      if (produto) {
        setTicketInitialData({
          assunto: `Previsão de Estoque: ${produto.nome}`,
          descricao: `Olá, gostaria de solicitar informações e/ou previsão de estoque para o produto:\n\n- ${produto.nome}\n\nAgradeço desde já!`,
        });
        setIsModalOpen(true);
      }
    };

    window.addEventListener('open-stock-ticket', handleOpenStockTicket);

    const channel = supabase
      .channel('tickets-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tickets',
        filter: `cliente_id=eq.${clientId}`
      }, () => {
        fetchTickets();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('open-stock-ticket', handleOpenStockTicket);
    };
  }, [activeTab, clientId]);

  useEffect(() => {
    if (selectedTicket?.id && isChatOpen) {
      fetchMessages(selectedTicket.id);
      
      const channel = supabase
        .channel(`ticket_${selectedTicket.id}`)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'ticket_mensagens',
          filter: `ticket_id=eq.${selectedTicket.id}`
        }, (payload) => {
          setMessages(prev => [...prev, payload.new as TicketMensagem]);
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'tickets',
          filter: `id=eq.${selectedTicket.id}`
        }, (payload) => {
          setSelectedTicket(prev => prev ? { ...prev, ...payload.new } as Ticket : null);
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedTicket?.id, isChatOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchTickets = async () => {
    setLoading(true);
    let query = supabase
      .from('tickets')
      .select('*')
      .eq('cliente_id', clientId)
      .order('data_abertura', { ascending: false });
      
    if (activeTab === 'aberto') {
      query = query.in('status', ['aberto', 'em andamento']);
    } else {
      query = query.eq('status', activeTab);
    }
    
    const { data } = await query;
    if (data) setTickets(data as any);
    setLoading(false);
  };

  const fetchMessages = async (ticketId: string) => {
    setLoadingMessages(true);
    const { data } = await supabase
      .from('ticket_mensagens')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('data_envio', { ascending: true });
    if (data) setMessages(data);
    setLoadingMessages(false);
  };

  const handleSendMessage = async () => {
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
        `O cliente ${cliente?.nome || clientId} enviou uma mensagem no ticket #${selectedTicket.id.slice(0, 8)}.`,
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
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async (formData: any) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);

    try {
      let ticket: { id: string } | null = null;
      try {
        ticket = await clientOperationalWrite<{ id: string }>(clientId, 'tickets', 'insert', {
          ...formData,
          status: 'aberto'
        });
      } catch (error: any) {
        console.error('Erro ao abrir ticket:', error);
        let errorMsg = 'Não foi possível processar sua solicitação agora. Por favor, tente novamente em instantes.';
        
        if (error.message?.includes('multiple (or no) rows returned')) {
          errorMsg = 'Sua solicitação já está sendo processada. Por favor, aguarde alguns segundos.';
        } else if (error.message) {
          errorMsg = `Erro ao abrir ticket: ${error.message}`;
        }
        
        toast.error(errorMsg);
        return;
      }
        // Notify Admin com notifyAdmin para gerar badge no sininho
        await notificationService.notifyAdmin(
          '🎟️ Novo Ticket de Suporte',
          `${clientId} abriu um ticket: "${formData.assunto}"`,
          'suporte',
          'ticket_aberto_cliente',
          { itemId: ticket.id, tab: 'abertos' }
        );

        // Notify Client
        await notificationService.notifyClient(
          clientId,
          'Ticket de Suporte Aberto! 💬',
          `Seu chamado "${formData.assunto}" foi registrado. Nossa equipe retornará em breve.`,
          'suporte',
          'ticket_aberto',
          { itemId: ticket.id, tab: 'abertos' }
        );

        toast.success('Ticket aberto com sucesso. Aguarde o atendimento.');
        setIsModalOpen(false);
        fetchTickets();
    } finally {
      setIsSubmitting(false);
      submittingRef.current = false;
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4">
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 font-bold text-white shadow-lg shadow-indigo-600/20 transition-all hover:bg-indigo-700 w-full sm:w-auto self-start"
        >
          <Plus className="h-5 w-5" />
          Abrir Novo Ticket
        </button>

        <div className="w-full min-w-0 sm:w-auto self-start">
          <div ref={suporteTabsRef} className="flex w-full gap-1 rounded-3xl bg-neutral-200/50 p-1 ring-1 ring-neutral-300 shadow-inner">
            {['aberto', 'concluido'].map((t, index) => (
              <button 
                key={t}
                ref={setSuporteTabButtonRef(index)}
                onClick={() => setActiveTab(t as any)}
                className={`min-w-0 flex-1 whitespace-nowrap rounded-2xl px-1.5 py-2.5 font-black capitalize leading-none transition-all sm:px-6 ${activeTab === t ? 'bg-white text-indigo-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}`}
              >
                {t === 'aberto' ? 'Abertos' : 'Concluídos'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center py-24">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
            <p className="mt-4 text-xs font-bold text-neutral-400 uppercase tracking-widest">Carregando seus tickets...</p>
          </div>
        ) : tickets.length > 0 ? (
          tickets.map((ticket) => (
            <div 
              id={`ticket-${ticket.id}`}
              key={ticket.id} 
              onClick={() => { setSelectedTicket(ticket); setIsChatOpen(true); }}
              className={`group relative cursor-pointer rounded-3xl p-8 transition-all duration-500 ${highlightedItemId === ticket.id ? 'bg-indigo-50 ring-4 ring-indigo-500 shadow-2xl scale-[1.02] z-10' : 'bg-white shadow-md ring-1 ring-neutral-300 hover:shadow-xl'}`}
            >
              <div className="mb-4 flex items-center justify-between">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${ticket.status === 'aberto' ? 'bg-amber-50 text-amber-600' : ticket.status === 'em andamento' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  <MessageSquare className="h-5 w-5" />
                </div>
                <span className="text-xs font-bold text-neutral-400">{formatDateTime(ticket.data_abertura)}</span>
              </div>
              <h3 className="text-xl font-bold text-neutral-900">{ticket.assunto}</h3>
              <p className="mt-2 text-sm text-neutral-500 line-clamp-2">{ticket.descricao}</p>
              
              <div className="mt-6 flex items-center gap-2 border-t border-neutral-100 pt-4">
                <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${ticket.status === 'aberto' ? 'bg-amber-100 text-amber-700' : ticket.status === 'em andamento' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {ticket.status}
                </span>
                {ticket.status === 'em andamento' && (
                  <span className="text-[10px] font-bold text-indigo-600">Um atendente está analisando seu caso. Clique para conversar.</span>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="py-24 text-center">
            <p className="text-neutral-400 font-medium">Nenhum ticket encontrado nesta categoria.</p>
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setTicketInitialData({}); }} title="Abrir Novo Ticket" size="wide">
        <TicketForm onSubmit={handleCreate} onCancel={() => { setIsModalOpen(false); setTicketInitialData({}); }} isSubmitting={isSubmitting} initialData={ticketInitialData} />
      </Modal>

      <Modal isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} title="Conversa com Suporte" size="full">
        {selectedTicket && (
          <div className="flex flex-col h-[600px]">
            <div className="rounded-2xl bg-neutral-100 p-4 ring-1 ring-neutral-300 mb-4">
              <h4 className="font-bold text-neutral-900">{selectedTicket.assunto}</h4>
              <p className="mt-1 text-xs text-neutral-500">{selectedTicket.descricao}</p>
            </div>

            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto space-y-4 p-4 bg-neutral-100/50 rounded-2xl ring-1 ring-neutral-300 mb-4"
            >
              {loadingMessages ? (
                <p className="text-center text-xs text-neutral-400">Carregando mensagens...</p>
              ) : messages.length > 0 ? (
                messages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`flex flex-col ${msg.tipo === 'cliente' ? 'items-end' : 'items-start'}`}
                  >
                    <div className={`max-w-[80%] rounded-2xl p-3 text-sm ${msg.tipo === 'cliente' ? 'bg-indigo-600 text-white' : 'bg-white text-neutral-900 shadow-sm ring-1 ring-neutral-100'}`}>
                      <p className="font-bold text-[10px] opacity-70 mb-1">{msg.autor_nome}</p>
                      {msg.anexo_url && (
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
                      )}
                      {msg.mensagem && <p className="whitespace-pre-wrap">{msg.mensagem}</p>}
                      <p className="text-[9px] opacity-50 mt-1 text-right">{formatDateTime(msg.data_envio)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-xs text-neutral-400 mt-10">Aguardando resposta do suporte...</p>
              )}
            </div>

            {selectedTicket.status !== 'concluido' ? (
              <div className="flex flex-col gap-2">
                {attachment && (
                  <div className="flex items-center gap-2 rounded-xl bg-neutral-100 p-2 ring-1 ring-neutral-200 self-start">
                    {attachment.type.startsWith('image/') ? <ImageIcon className="h-4 w-4 text-indigo-500" /> : <FileIcon className="h-4 w-4 text-indigo-500" />}
                    <span className="text-xs font-medium text-neutral-700 max-w-[200px] truncate">{attachment.name}</span>
                    <button onClick={() => setAttachment(null)} className="rounded-full p-1 hover:bg-neutral-200 text-neutral-500 transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                <div className="flex gap-4 items-center">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        setAttachment(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100 text-neutral-500 transition-all hover:bg-neutral-200 shrink-0"
                    title="Anexar arquivo"
                  >
                    <Paperclip className="h-5 w-5" />
                  </button>
                  <input 
                    type="text" 
                    placeholder="Digite sua mensagem..." 
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                    className="flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-indigo-500 focus:outline-none min-w-0"
                  />
                  <button 
                    onClick={handleSendMessage}
                    disabled={isSendingMessage || (!newMessage.trim() && !attachment)}
                    className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 transition-all hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  >
                    {isSendingMessage ? (
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <Send className="h-5 w-5 ml-1" />
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-center text-sm font-bold text-neutral-400 py-4">Este ticket foi encerrado.</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function TicketForm({ onSubmit, onCancel, isSubmitting, initialData }: { onSubmit: (data: any) => void, onCancel: () => void, isSubmitting: boolean, initialData?: { assunto?: string, descricao?: string } }) {
  const [formData, setFormData] = useState({
    assunto: initialData?.assunto || '',
    descricao: initialData?.descricao || ''
  });

  // Effect to update form if initialData changes while mounted
  useEffect(() => {
    if (initialData?.assunto || initialData?.descricao) {
      setFormData({
        assunto: initialData.assunto || '',
        descricao: initialData.descricao || ''
      });
    }
  }, [initialData]);

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(formData); }} className="space-y-6">
      <div>
        <label className="mb-1 block text-sm font-bold text-neutral-700">Assunto *</label>
        <input 
          type="text" 
          required
          placeholder="Ex: Dúvida sobre fatura, Problema técnico..."
          value={formData.assunto}
          onChange={e => setFormData({...formData, assunto: e.target.value})}
          className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-indigo-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-bold text-neutral-700">Descrição Detalhada *</label>
        <textarea 
          rows={5}
          required
          placeholder="Descreva seu problema ou dúvida com o máximo de detalhes possível..."
          value={formData.descricao}
          onChange={e => setFormData({...formData, descricao: e.target.value})}
          className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-indigo-500 focus:outline-none"
        />
      </div>
      <div className="flex gap-4 pt-4">
        <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-neutral-200 py-3 font-bold text-neutral-600 hover:bg-neutral-50">Cancelar</button>
        <button 
          type="submit" 
          disabled={isSubmitting}
          className="flex-1 rounded-xl bg-indigo-600 py-3 font-bold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <Send className="h-5 w-5" />
          )}
          {isSubmitting ? 'Enviando...' : 'Enviar Ticket'}
        </button>
      </div>
    </form>
  );
}
