import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Ticket, TicketMensagem } from '../../types';
import { formatDateTime } from '../../lib/utils';
import { MessageSquare, Plus, Clock, CheckCircle, Send, User, ChevronRight, Search, Paperclip, X, File as FileIcon, Image as ImageIcon, Download } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { toast } from 'react-hot-toast';
import { notificationService } from '../../lib/notificationService';
import { useAutoFitTabs } from '../../hooks/useAutoFitTabs';

export function PrestadorSuporte({ prestadorId, initialItemId }: { prestadorId: string, initialItemId?: string }) {
  const { containerRef: suporteTabsRef, setButtonRef: setSuporteTabButtonRef } = useAutoFitTabs(16, 9);
  const [activeTab, setActiveTab] = useState<'aberto' | 'em andamento' | 'concluido'>('aberto');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState<TicketMensagem[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const [attachment, setAttachment] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialItemId && tickets.length > 0) {
      const item = tickets.find(t => t.id === initialItemId);
      if (item) {
        setSelectedTicket(item);
        setIsChatOpen(true);
      }
    }
  }, [initialItemId, tickets]);

  useEffect(() => {
    fetchTickets();

    const channel = supabase
      .channel(`prestador-tickets-${prestadorId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tickets',
        filter: `prestador_id=eq.${prestadorId}`
      }, () => {
        fetchTickets();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTab, prestadorId]);

  useEffect(() => {
    if (selectedTicket?.id && isChatOpen) {
      fetchMessages(selectedTicket.id);
      
      const channel = supabase
        .channel(`prestador-ticket-msg-${selectedTicket.id}`)
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
    let query = supabase
      .from('tickets')
      .select('*')
      .eq('prestador_id', prestadorId);
    
    // Se tiver um initialItemId, não filtramos por status inicialmente para garantir que encontramos o item
    if (!initialItemId) {
      query = query.eq('status', activeTab);
    }
    
    const { data } = await query.order('data_abertura', { ascending: false });
    
    if (data) {
      setTickets(data as any);
      
      // Se tiver initialItemId e encontramos o ticket, mudamos para a aba dele
      if (initialItemId) {
        const target = data.find(t => t.id === initialItemId);
        if (target && target.status !== activeTab) {
          setActiveTab(target.status as any);
        }
      }
    }
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
    if ((!newMessage.trim() && !attachment) || !selectedTicket || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const { data: prestador } = await supabase.from('prestadores').select('nome_razao').eq('id', prestadorId).single();

      let anexo_url = '';
      let anexo_tipo = '';

      if (attachment) {
        const fileExt = attachment.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
        const filePath = `chat/prestador/${prestadorId}/${fileName}`;

        const bucketName = 'documentos_prestador';
        const { error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(filePath, attachment);

        if (uploadError) {
          throw uploadError;
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from(bucketName)
            .getPublicUrl(filePath);
          anexo_url = publicUrl;
        }
        anexo_tipo = attachment.type;
      }

      const tempMessage: TicketMensagem = {
        id: Date.now().toString(),
        ticket_id: selectedTicket.id,
        autor_id: prestadorId,
        autor_nome: prestador?.nome_razao || 'Prestador',
        mensagem: newMessage,
        anexo_url: anexo_url || undefined,
        anexo_tipo: anexo_tipo || undefined,
        data_envio: new Date().toISOString(),
        tipo: 'prestador' as any
      };
      setMessages(prev => [...prev, tempMessage]);
      setNewMessage('');
      setAttachment(null);

      const { error } = await supabase.from('ticket_mensagens').insert([{
        ticket_id: selectedTicket.id,
        autor_id: prestadorId,
        autor_nome: prestador?.nome_razao || 'Prestador',
        mensagem: newMessage,
        anexo_url: anexo_url || null,
        anexo_tipo: anexo_tipo || null,
        tipo: 'prestador' as any
      }]);

      if (error) {
        setMessages(prev => prev.filter(m => m.id !== tempMessage.id));
        console.error('Erro ao enviar mensagem:', error);
        toast.error('Erro ao enviar mensagem.');
      } else {
        const adminTab = selectedTicket.status === 'aberto' ? 'abertos' : 'em andamento';
        await notificationService.notifyAdmin(
          'Nova Mensagem (Prestador)',
          `O prestador ${prestador?.nome_razao || prestadorId} enviou uma mensagem no ticket #${selectedTicket.id.slice(0, 8)}.`,
          'suporte',
          'ticket_mensagem_recebida',
          { tab: adminTab, itemId: selectedTicket.id, contexto: { prestador_id: prestadorId, ticket_id: selectedTicket.id } }
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreate = async (formData: any) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const { data: ticket, error } = await supabase.from('tickets').insert([{
        ...formData,
        prestador_id: prestadorId,
        status: 'aberto'
      }]).select('id').single();

      if (error) {
        console.error('Erro ao abrir ticket:', error);
        toast.error(`Erro ao abrir ticket: ${error.message || 'Erro desconhecido'}`);
      } else {
        await notificationService.notifyAdmin(
          'Novo Ticket de Prestador',
          `Um novo ticket foi aberto pelo prestador. Assunto: ${formData.assunto}`,
          'suporte',
          'ticket_aberto_prestador',
          { tab: 'abertos', itemId: ticket.id, contexto: { prestador_id: prestadorId, ticket_id: ticket.id } }
        );

        toast.success('Ticket aberto com sucesso. Aguarde o atendimento.');
        setIsModalOpen(false);
        fetchTickets();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header with Info and Action */}
      <div className="bg-[#1a1a1a] p-8 rounded-[2.5rem] text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-3xl tracking-tight mb-2">Central de Ajuda</h2>
            <p className="text-indigo-200/60 text-sm max-w-md">Precisa de suporte técnico ou financeiro? Abra um chamado e nossa equipe retornará em breve.</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-3 bg-white text-[#1a1a1a] px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-neutral-100 transition-all shadow-xl active:scale-[0.98]"
          >
            <Plus className="h-5 w-5" />
            Novo Atendimento
          </button>
        </div>
      </div>

      {/* Tabs and Filtering */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div ref={suporteTabsRef} className="flex w-full gap-1 rounded-2xl bg-neutral-100 p-1 ring-1 ring-neutral-200 sm:w-auto">
          {(['aberto', 'em andamento', 'concluido'] as const).map((t, index) => (
            <button 
              key={t}
              ref={setSuporteTabButtonRef(index)}
              onClick={() => setActiveTab(t)}
              className={`min-w-0 flex-1 whitespace-nowrap rounded-xl px-1.5 py-2.5 font-black uppercase leading-none tracking-[0.08em] transition-all sm:flex-none sm:px-8 sm:tracking-widest ${activeTab === t ? 'bg-white text-[#1a1a1a] shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Tickets List */}
      <div className="grid grid-cols-1 gap-4">
        {tickets.map((ticket) => (
          <div 
            id={`ticket-${ticket.id}`}
            key={ticket.id} 
            onClick={() => { setSelectedTicket(ticket); setIsChatOpen(true); }}
            className="group relative cursor-pointer rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-neutral-200 transition-all hover:shadow-xl hover:ring-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="flex items-center gap-5">
              <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl transition-all group-hover:scale-110 ${
                ticket.status === 'aberto' ? 'bg-amber-50 text-amber-600' : 
                ticket.status === 'em andamento' ? 'bg-indigo-50 text-indigo-600' : 
                'bg-emerald-50 text-emerald-600'
              }`}>
                <MessageSquare className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-neutral-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{ticket.assunto}</h3>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[10px] font-bold text-neutral-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDateTime(ticket.data_abertura)}
                  </span>
                  <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                    ticket.status === 'aberto' ? 'bg-amber-100 text-amber-700' : 
                    ticket.status === 'em andamento' ? 'bg-indigo-100 text-indigo-700' : 
                    'bg-emerald-100 text-emerald-700'
                  }`}>
                    {ticket.status}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-4 sm:pt-0">
               <div className="hidden lg:block text-right pr-4 border-r border-neutral-100 mr-4">
                  <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-0.5">ID Ticket</p>
                  <p className="text-xs font-bold text-[#1a1a1a]">#{ticket.id.slice(0, 8)}</p>
               </div>
               <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm group-hover:translate-x-1 transition-transform">
                  Ver Conversa
                  <ChevronRight className="w-4 h-4" />
               </div>
            </div>
          </div>
        ))}

        {tickets.length === 0 && (
          <div className="py-24 text-center bg-neutral-50 rounded-[3rem] border-2 border-dashed border-neutral-200">
            <MessageSquare className="w-16 h-16 text-neutral-200 mx-auto mb-4" />
            <p className="text-neutral-400 font-black uppercase tracking-widest text-sm">Nenhum ticket encontrado</p>
            <p className="text-xs text-neutral-400 mt-1">Sua lista de atendimentos {activeTab}s está vazia.</p>
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Novo Atendimento" size="full">
        <TicketForm onSubmit={handleCreate} onCancel={() => setIsModalOpen(false)} isSubmitting={isSubmitting} />
      </Modal>

      <Modal isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} title="Chat de Suporte" size="full">
        {selectedTicket && (
          <div className="flex flex-col h-[650px]">
            {/* Ticket Header inside Modal */}
            <div className="rounded-3xl bg-neutral-50 p-6 ring-1 ring-neutral-200 mb-6 border-l-4 border-indigo-600">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">#{selectedTicket.id.slice(0, 8)}</span>
                <span className="text-[10px] font-bold text-neutral-400">{formatDateTime(selectedTicket.data_abertura)}</span>
              </div>
              <h4 className="font-black text-neutral-900 uppercase tracking-tight text-lg">{selectedTicket.assunto}</h4>
              <p className="mt-2 text-xs text-neutral-600 leading-relaxed">{selectedTicket.descricao}</p>
            </div>

            {/* Chat Messages */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto space-y-6 p-6 bg-neutral-50 rounded-[2rem] ring-1 ring-neutral-200 mb-6 custom-scrollbar"
            >
              {loadingMessages ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"/>
                  <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Carregando mensagens...</p>
                </div>
              ) : messages.length > 0 ? (
                messages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`flex ${msg.tipo === 'prestador' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[85%] flex flex-col ${msg.tipo === 'prestador' ? 'items-end' : 'items-start'}`}>
                      <div className={`rounded-2xl p-4 shadow-sm ${
                        msg.tipo === 'prestador' 
                          ? 'bg-[#1a1a1a] text-white rounded-tr-none' 
                          : 'bg-white text-neutral-900 ring-1 ring-neutral-100 rounded-tl-none'
                      }`}>
                        <div className="flex items-center gap-2 mb-2">
                           <div className={`w-5 h-5 rounded-full flex items-center justify-center ${msg.tipo === 'prestador' ? 'bg-indigo-600' : 'bg-neutral-100'}`}>
                             <User className={`w-3 h-3 ${msg.tipo === 'prestador' ? 'text-white' : 'text-neutral-500'}`} />
                           </div>
                           <p className="font-black text-[9px] uppercase tracking-widest opacity-80">{msg.autor_nome}</p>
                        </div>
                        {msg.anexo_url && (
                          <div className="mb-2">
                            {msg.anexo_tipo?.startsWith('image/') ? (
                              <a href={msg.anexo_url} target="_blank" rel="noopener noreferrer">
                                <img src={msg.anexo_url} alt="Anexo" className="rounded-lg max-h-48 object-cover mb-2 ring-1 ring-black/10" />
                              </a>
                            ) : (
                              <a href={msg.anexo_url} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 p-2 rounded-lg text-xs font-bold transition-all ${msg.tipo === 'prestador' ? 'bg-black/10 hover:bg-black/20 text-white' : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'}`}>
                                <FileIcon className="h-4 w-4" />
                                Baixar Anexo
                                <Download className="h-3 w-3 ml-auto opacity-50" />
                              </a>
                            )}
                          </div>
                        )}
                        {msg.mensagem && <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.mensagem}</p>}
                      </div>
                      <span className="text-[9px] font-bold text-neutral-400 mt-1 uppercase tracking-tight">{formatDateTime(msg.data_envio)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-24 text-center">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm ring-1 ring-neutral-100">
                    <Clock className="w-8 h-8 text-neutral-300" />
                  </div>
                  <p className="text-xs font-black text-neutral-400 uppercase tracking-widest">Aguardando atendimento...</p>
                  <p className="text-[10px] text-neutral-400 mt-1">Normalmente respondemos em até 2 horas úteis.</p>
                </div>
              )}
            </div>

            {/* Input Area */}
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
                <div className="flex items-center gap-2 bg-white rounded-2xl border border-neutral-200 shadow-sm p-1">
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
                    placeholder="Envie sua dúvida ou resposta aqui..." 
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                    className="w-full bg-transparent px-4 py-4 pr-16 text-sm focus:outline-none transition-all font-medium"
                  />
                  <button 
                    onClick={handleSendMessage}
                    disabled={(!newMessage.trim() && !attachment) || isSubmitting}
                    className="right-3 rounded-xl bg-[#1a1a1a] p-3 text-white shadow-lg transition-all hover:bg-black active:scale-95 disabled:opacity-20 disabled:grayscale shrink-0"
                  >
                    <Send className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex items-center justify-center gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <p className="text-sm font-black text-emerald-700 uppercase tracking-widest">Ticket Encerrado com Sucesso</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function TicketForm({ onSubmit, onCancel, isSubmitting }: { onSubmit: (data: any) => void, onCancel: () => void, isSubmitting?: boolean }) {
  const [formData, setFormData] = useState({
    assunto: '',
    descricao: ''
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(formData); }} className="space-y-6">
      <div>
        <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest mb-1 ml-1 block">Assunto do Atendimento *</label>
        <input 
          type="text" 
          required
          placeholder="Ex: Problema com pagamento, Alteração de dados..."
          value={formData.assunto}
          onChange={e => setFormData({...formData, assunto: e.target.value})}
          className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3.5 focus:border-[#1a1a1a] focus:outline-none transition-all font-medium"
        />
      </div>
      <div>
        <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest mb-1 ml-1 block">Detalhes da Solicitação *</label>
        <textarea 
          rows={5}
          required
          placeholder="Descreva detalhadamente como podemos te ajudar..."
          value={formData.descricao}
          onChange={e => setFormData({...formData, descricao: e.target.value})}
          className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3.5 focus:border-[#1a1a1a] focus:outline-none transition-all font-medium resize-none"
        />
      </div>
      <div className="flex gap-4 pt-4">
        <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-neutral-200 py-4 font-black text-neutral-500 hover:bg-neutral-100 uppercase tracking-widest text-[10px] transition-all">Cancelar</button>
        <button type="submit" disabled={isSubmitting} className="flex-1 rounded-xl bg-[#1a1a1a] py-4 font-black text-white shadow-lg shadow-black/20 hover:bg-black uppercase tracking-widest text-[10px] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed">
          <Send className="mr-2 inline-block h-4 w-4" />
          {isSubmitting ? 'Enviando...' : 'Enviar Chamado'}
        </button>
      </div>
    </form>
  );
}
