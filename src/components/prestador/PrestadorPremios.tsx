import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { Gift, CheckCircle, Trophy, Star, Info, AlertCircle, Clock, Check, MessageSquare } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { createNotification } from '../../lib/notifications';
import { notificationService } from '../../lib/notificationService';
import { formatDate } from '../../lib/utils';

interface PrestadorPremiosProps {
  prestadorId: string;
  initialItemId?: string;
}

export function PrestadorPremios({ prestadorId, initialItemId }: PrestadorPremiosProps) {
  const [premios, setPremios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPremio, setSelectedPremio] = useState<any>(null);
  const [isRedeemModalOpen, setIsRedeemModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);

  useEffect(() => {
    if (initialItemId && premios.length > 0) {
      const premio = premios.find(p => p.id === initialItemId);
      if (premio) {
        setTimeout(() => {
          const element = document.getElementById(`premio-${initialItemId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHighlightedItemId(initialItemId);
            setTimeout(() => setHighlightedItemId(null), 3000);
          }
        }, 400);
      }
    }
  }, [initialItemId, premios.length]);

  useEffect(() => {
    fetchPremios();
    const channel = supabase
      .channel(`prestador-premios-${prestadorId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prestador_premios', filter: `prestador_id=eq.${prestadorId}` }, fetchPremios)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [prestadorId]);

  const fetchPremios = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('prestador_premios')
        .select('*')
        .eq('prestador_id', prestadorId)
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === '42P01') {
          console.warn('Tabela prestador_premios não existe ainda.');
          setPremios([]);
          return;
        }
        throw error;
      }
      setPremios(data || []);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao buscar prêmios.');
    } finally {
      setLoading(false);
    }
  };

  const handleRedeemClick = (premio: any) => {
    setSelectedPremio(premio);
    setIsRedeemModalOpen(true);
  };

  const confirmarResgate = async () => {
    if (!selectedPremio) return;
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('prestador_premios')
        .update({ 
          status: 'resgatado', 
          data_resgate: new Date().toISOString() 
        })
        .eq('id', selectedPremio.id);
      
      if (error) throw error;

      await notificationService.notifyAdmin(
        '🏆 Prêmio Resgatado pelo Prestador',
        `O prestador solicitou o resgate do prêmio "${selectedPremio.titulo}". Por favor, entre em contato via WhatsApp/telefone em até 48 horas para alinhar a entrega.`,
        'premios',
        'premio_resgate_solicitado',
        { tab: 'resgatados', itemId: selectedPremio.id, contexto: { prestador_id: prestadorId, premio_id: selectedPremio.id } }
      );
      
      toast.success('Parabéns! O resgate foi solicitado com sucesso.');
      setIsRedeemModalOpen(false);
      setSelectedPremio(null);
      fetchPremios();
    } catch (e: any) {
      console.error(e);
      toast.error('Erro ao resgatar o prêmio: ' + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAbrirTicket = async (premio: any) => {
    setIsSubmitting(true);
    try {
      const assunto = `Dúvida sobre o Prêmio: ${premio.titulo}`;

      // Verificação de ticket duplicado
      const { data: existingTickets, error: checkError } = await supabase
        .from('tickets')
        .select('id')
        .eq('prestador_id', prestadorId)
        .eq('assunto', assunto)
        .neq('status', 'concluido')
        .limit(1);

      if (checkError) throw checkError;

      if (existingTickets && existingTickets.length > 0) {
        toast.error('Identificamos que já existe um atendimento em andamento para este prêmio. Por favor, acompanhe a evolução no Suporte.');
        return;
      }

      const { error } = await supabase.from('tickets').insert([{
        assunto,
        descricao: `Gostaria de tirar uma dúvida referente ao prêmio "${premio.titulo}" (Resgatado em ${premio.data_resgate ? formatDate(premio.data_resgate) : 'data indisponível'}).`,
        prestador_id: prestadorId,
        status: 'aberto'
      }]);

      if (error) throw error;

      await notificationService.notifyAdmin(
        'Novo Ticket de Prestador (Prêmios)',
        `O prestador abriu um ticket com dúvidas sobre o prêmio ${premio.titulo}.`,
        'suporte',
        'ticket_aberto_prestador',
        { tab: 'abertos', contexto: { prestador_id: prestadorId } }
      );

      toast.success('Ticket aberto com sucesso! Nossa equipe entrará em contato via Dúvidas.');
    } catch (e: any) {
      console.error(e);
      toast.error('Não foi possível processar sua solicitação agora. Por favor, tente novamente em instantes ou utilize o canal de suporte geral.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="py-12 flex justify-center"><div className="w-8 h-8 rounded-full border-4 border-rose-600 border-t-transparent animate-spin"/></div>;

  const disponiveis = premios.filter(p => p.status === 'disponivel');
  const resgatados = premios.filter(p => p.status === 'resgatado');

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5 overflow-hidden">
        <div className="p-6 border-b border-neutral-100 flex justify-between items-center bg-rose-50/50">
          <div>
            <h3 className="text-lg font-medium text-neutral-900 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-rose-600" />
              Prêmios Disponíveis
            </h3>
            <p className="text-sm text-neutral-500 mt-1">Reconhecimento pelo seu excelente trabalho.</p>
          </div>
          <span className="bg-rose-100 text-rose-700 px-3 py-1 rounded-full text-sm font-bold">
            {disponiveis.length} disponíveis
          </span>
        </div>
        
        {disponiveis.length === 0 ? (
          <div className="p-12 text-center text-neutral-500">
            <Gift className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
            <p className="font-medium text-neutral-900">Nenhum prêmio disponível</p>
            <p className="text-sm mt-1">Mantenha a qualidade dos serviços para desbloquear recompensas exclusivas.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
            {disponiveis.map(premio => (
              <div 
                id={`premio-${premio.id}`}
                key={premio.id} 
                className={`group relative overflow-hidden rounded-[2.5rem] border transition-all duration-500 flex flex-col ring-1 ring-black/[0.02] ${
                  highlightedItemId === premio.id 
                    ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500 scale-[1.02] z-10 shadow-2xl' 
                    : 'border-neutral-200 bg-white p-8 shadow-sm hover:shadow-2xl hover:-translate-y-1'
                } p-8`}
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="w-16 h-16 rounded-[1.5rem] bg-rose-50 text-rose-500 flex items-center justify-center shrink-0 border border-rose-100/50 group-hover:scale-110 transition-transform duration-500 shadow-sm shadow-rose-500/10">
                    <Gift className="w-8 h-8" />
                  </div>
                  <div className="bg-rose-100/50 backdrop-blur-sm rounded-full px-3 py-1 text-rose-600 flex items-center gap-1.5 border border-rose-200/50">
                    <Star className="w-3.5 h-3.5 fill-rose-600" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Premium</span>
                  </div>
                </div>
                
                <h4 className="text-2xl font-black text-[#1a1a1a] mb-3 group-hover:text-rose-600 transition-colors uppercase tracking-tight">{premio.titulo}</h4>
                <p className="text-sm text-neutral-500 mb-8 flex-1 leading-relaxed opacity-80 group-hover:opacity-100 transition-opacity">{premio.descricao}</p>
                
                <button
                  onClick={() => handleRedeemClick(premio)}
                  className="w-full bg-[#1a1a1a] hover:bg-black text-white font-black py-4 rounded-2xl transition-all active:scale-[0.98] shadow-xl shadow-black/10 flex items-center justify-center gap-2"
                >
                  Resgatar Agora
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {resgatados.length > 0 && (
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5 overflow-hidden">
          <div className="p-6 border-b border-neutral-100">
            <h3 className="text-lg font-medium text-neutral-900">Histórico de Prêmios</h3>
          </div>
          <div className="divide-y divide-neutral-100 text-sm">
            {resgatados.map(p => (
              <div 
                id={`premio-${p.id}`}
                key={p.id} 
                className={`p-4 sm:p-6 flex items-center justify-between hover:bg-neutral-50 transition-all duration-500 ${
                  highlightedItemId === p.id 
                    ? 'bg-indigo-50/50 ring-2 ring-indigo-500 scale-[1.01] z-10 shadow-lg rounded-xl' 
                    : ''
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 shadow-sm border border-emerald-100">
                    <Gift className="w-6 h-6" />
                  </div>
                  <div>
                    <h5 className="font-bold text-neutral-900">{p.titulo}</h5>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Resgatado em {p.data_resgate ? formatDate(p.data_resgate) : 'data indisponível'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setSelectedPremio(p); setIsDetailsModalOpen(true); }} className="px-3 py-1.5 text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl transition-colors flex items-center gap-1">
                    <Info className="h-4 w-4" /> Detalhes
                  </button>
                  <button onClick={() => handleAbrirTicket(p)} disabled={isSubmitting} className="px-3 py-1.5 text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1">
                    <MessageSquare className="h-4 w-4" /> Dúvidas?
                  </button>
                  <div className="hidden sm:flex items-center gap-1.5 text-emerald-700 font-black text-[10px] bg-emerald-100 px-4 py-1.5 rounded-full uppercase tracking-widest border border-emerald-200">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Resgatado
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Redemption Instructions Modal */}
      <Modal 
        isOpen={isRedeemModalOpen} 
        onClose={() => setIsRedeemModalOpen(false)} 
        title="Instruções de Resgate"
        size="wide"
      >
        {selectedPremio && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center bg-neutral-50 p-6 rounded-[2rem] border border-neutral-100 shadow-inner">
              <div className="w-24 h-24 rounded-[1.5rem] bg-rose-50 flex items-center justify-center text-rose-500 shadow-sm border border-rose-100">
                <Gift className="w-12 h-12" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-500 mb-1">Você selecionou:</p>
                <h4 className="text-3xl font-black text-[#1a1a1a] uppercase tracking-tight">{selectedPremio.titulo}</h4>
                <p className="text-sm text-neutral-500 mt-1 line-clamp-2 leading-relaxed">{selectedPremio.descricao}</p>
              </div>
            </div>

            <div className="space-y-6">
              <h5 className="text-lg font-bold text-[#1a1a1a] flex items-center gap-2">
                <Info className="w-5 h-5 text-rose-500" />
                Como funcionará a entrega?
              </h5>
              
              <div className="space-y-4">
                <div className="flex gap-4 p-4 rounded-2xl bg-white ring-1 ring-black/5">
                  <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-[#1a1a1a]">Prazo de Notificação</p>
                    <p className="text-sm text-neutral-500 mt-0.5">Nossa equipe administrativa receberá seu pedido instantaneamente.</p>
                  </div>
                </div>

                <div className="flex gap-4 p-4 rounded-2xl bg-white ring-1 ring-black/5">
                  <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                    <Star className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-[#1a1a1a]">Contato de Confirmado</p>
                    <p className="text-sm text-neutral-500 mt-0.5">Entraremos em contato via WhatsApp ou telefone em até 48 horas úteis para alinhar os detalhes.</p>
                  </div>
                </div>

                <div className="flex gap-4 p-4 rounded-2xl bg-white ring-1 ring-black/5">
                  <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                    <Gift className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-[#1a1a1a]">Forma de Entrega</p>
                    <p className="text-sm text-neutral-500 mt-0.5">Dependendo do prêmio, ele poderá ser entregue via Correios, Voucher Digital ou agendamento para retirada.</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-amber-50 p-4 border border-amber-100">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800 leading-relaxed font-medium">
                    Importante: Ao resgatar, você declara que suas informações de contato (WhatsApp e Telefone) estão atualizadas em seu perfil.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button 
                onClick={() => setIsRedeemModalOpen(false)}
                className="flex-1 px-8 py-4 rounded-2xl font-bold text-neutral-500 hover:bg-neutral-100 transition-colors"
              >
                Cancelar
              </button>
              <button 
                disabled={isSubmitting}
                onClick={confirmarResgate}
                className="flex-[2] bg-[#1a1a1a] hover:bg-black text-white px-8 py-4 rounded-2xl font-bold shadow-xl shadow-black/10 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    Confirmar Resgate
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Detalhes do Prêmio Resgatado */}
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedPremio(null);
        }}
        title="Detalhes do Prêmio Resgatado"
        size="full"
      >
        {selectedPremio && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center bg-neutral-50 p-6 rounded-[2rem] border border-neutral-100 shadow-inner">
               <div className="w-24 h-24 rounded-[1.5rem] bg-emerald-50 flex items-center justify-center text-emerald-500 shadow-sm border border-emerald-100">
                <Gift className="w-12 h-12" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 mb-1">Prêmio Selecionado:</p>
                <h4 className="text-3xl font-black text-[#1a1a1a] uppercase tracking-tight">{selectedPremio.titulo}</h4>
              </div>
            </div>
            
            <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-md">
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                </div>
                <h4 className="font-black text-emerald-900 text-lg uppercase tracking-tight">Status: Resgatado</h4>
              </div>
              <p className="text-emerald-800 text-sm leading-relaxed mb-4">
                Este prêmio já foi resgatado com a nossa equipe em <strong>{selectedPremio.data_resgate ? formatDate(selectedPremio.data_resgate) : 'data indisponível'}</strong>. 
                <br /><br />
                {selectedPremio.descricao}
              </p>
            </div>
            
            <button
              onClick={() => {
                setIsDetailsModalOpen(false);
                setSelectedPremio(null);
              }}
              className="w-full px-6 py-4 rounded-2xl font-black text-neutral-500 hover:bg-neutral-100 transition-colors uppercase tracking-widest text-xs"
            >
              Fechar Detalhes
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
