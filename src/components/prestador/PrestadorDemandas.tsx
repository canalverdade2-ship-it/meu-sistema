import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { FileText, CheckCircle, XCircle, Clock, MessageSquare, AlertCircle, Upload, DollarSign, Calendar, Info, AlignLeft, ArrowRightLeft, Send, History } from 'lucide-react';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import { Modal } from '../ui/Modal';
import { DemandasComentarios } from '../admin/demandas/DemandasComentarios';
import { notificationService } from '../../lib/notificationService';
import { osService } from '../../lib/osService';
import { useProviderNotifications } from '../../hooks/useProviderNotifications';
import { logService } from '../../lib/logService';
import { demandService } from '../../lib/demandService';

interface PrestadorDemandasProps {
  prestadorId: string;
}

export function PrestadorDemandas({ prestadorId, initialItemId }: PrestadorDemandasProps & { initialItemId?: string }) {
  const { pendencies, refreshCounts } = useProviderNotifications();
  const [demandas, setDemandas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('abertas');
  
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);

  useEffect(() => {
    if (initialItemId && demandas.length > 0) {
      const demanda = demandas.find(d => d.id === initialItemId);
      if (demanda) {
        // Map status to tab
        if (['aberta', 'em_negociacao', 'contraproposta_prestador', 'contraproposta_admin_final'].includes(demanda.status)) {
          setActiveTab('abertas');
        } else if (['ativa', 'em_analise', 'em_ajuste', 'concluida_interna'].includes(demanda.status)) {
          setActiveTab('ativas');
        } else if (['concluida', 'cancelada', 'finalizada'].includes(demanda.status)) {
          setActiveTab('concluidas');
        }

        // Auto open modal
        setSelectedDemanda(demanda);
        setIsModalOpen(true);
        fetchHistoricoDemanda(demanda.id);

        setTimeout(() => {
          const element = document.getElementById(`demanda-${initialItemId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHighlightedItemId(initialItemId);
            setTimeout(() => setHighlightedItemId(null), 3000);
          }
        }, 400);
      }
    }
  }, [initialItemId, demandas.length]);
  
  const [selectedDemanda, setSelectedDemanda] = useState<any>(null);
  const [historicoDemanda, setHistoricoDemanda] = useState<any[]>([]);

  const fetchHistoricoDemanda = async (demandaId: string) => {
    try {
      const { data, error } = await supabase
        .from('prestador_demandas_historico')
        .select(`
          *,
          origem:colaborador_origem_id(nome),
          destino:colaborador_destino_id(nome),
          destino_prestador:prestador_destino_id(nome_razao),
          origem_prestador:prestador_origem_id(nome_razao)
        `)
        .eq('demanda_id', demandaId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setHistoricoDemanda(data || []);
    } catch (error) {
      console.error('Erro ao buscar historico:', error);
    }
  };
  const [selectedSuporte, setSelectedSuporte] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, demanda: any | null}>({isOpen: false, demanda: null});
  const [recusaMotivo, setRecusaMotivo] = useState('');
  
  // Negociação
  const [isNegotiating, setIsNegotiating] = useState(false);
  const [contrapropostaValor, setContrapropostaValor] = useState('');
  const [contrapropostaMotivo, setContrapropostaMotivo] = useState('');
  
  // Entrega
  const [isDelivering, setIsDelivering] = useState(false);
  const [dataEntrega, setDataEntrega] = useState('');
  const [observacaoEntrega, setObservacaoEntrega] = useState('');
  const [linkResultado, setLinkResultado] = useState('');
  const [arquivosResultado, setArquivosResultado] = useState<File[]>([]);

  // Transferência
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferReason, setTransferReason] = useState('');
  const [arquivosTransferencia, setArquivosTransferencia] = useState<File[]>([]);

  // Suporte
  const [supportMessage, setSupportMessage] = useState('');

  const [prestadorNome, setPrestadorNome] = useState('Prestador');

  // Fetch prestador nome
  useEffect(() => {
    const fetchNome = async () => {
      const { data } = await supabase.from('prestadores').select('nome_razao').eq('id', prestadorId).single();
      if (data) setPrestadorNome(data.nome_razao);
    };
    fetchNome();
  }, [prestadorId]);

  const handleOpenSupport = (demanda: any) => {
    setSelectedDemanda(demanda);
    setIsSupportModalOpen(true);
  };

  useEffect(() => {
    fetchDemandas();

    const channel = supabase
      .channel(`prestador-demandas-${prestadorId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prestador_demandas', filter: `prestador_id=eq.${prestadorId}` }, () => {
        fetchDemandas();
        refreshCounts();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prestador_suporte_demandas', filter: `prestador_id=eq.${prestadorId}` }, () => {
        fetchDemandas();
        refreshCounts();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prestador_demandas_historico' }, (payload) => {
        const newEvent = payload.new as any;
        if (selectedDemanda && newEvent.demanda_id === selectedDemanda.id) {
          fetchHistoricoDemanda(selectedDemanda.id);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [prestadorId]);

  const fetchDemandas = async () => {
    try {
      const { data, error } = await supabase
        .from('prestador_demandas')
        .select(`
          *,
          ordem_servico:ordens_servico(
            id,
            codigo_os,
            motivo_cancelamento,
            cliente_id,
            orcamento:orcamentos(
              servico:servicos(nome)
            )
          )
        `)
        .eq('prestador_id', prestadorId)
        .order('created_at', { ascending: false });

      if (error) {
        if (error.message?.includes('detalhes')) {
          // Fallback if detalhes column is missing
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('prestador_demandas')
            .select(`
              id, prestador_id, os_id, titulo, descricao, valor_proposto_admin, valor_proposto_prestador, valor_final, status, data_inicio, data_conclusao, created_at, updated_at, ajuste_solicitado, prazo_ajuste, status_ajuste, link_resultado, arquivos_resultado, detalhes, arquivos_transferencia, arquivos_briefing
            `)
            .eq('prestador_id', prestadorId)
            .order('created_at', { ascending: false });
          
          if (fallbackError) throw fallbackError;
          setDemandas(fallbackData || []);
          return;
        }
        throw error;
      }
      setDemandas(data || []);
    } catch (error) {
      console.error('Erro ao buscar demandas:', error);
      toast.error('Erro ao carregar demandas.');
    } finally {
      setLoading(false);
    }
  };

  // Keep selectedDemanda and historico in sync when real-time updates the `demandas` list
  useEffect(() => {
    if (selectedDemanda && isModalOpen && demandas.length > 0) {
      const updatedDemanda = demandas.find(d => d.id === selectedDemanda.id);
      if (updatedDemanda) {
        // Only update state if something changed to prevent infinite loops or unnecessary re-renders
        if (JSON.stringify(updatedDemanda) !== JSON.stringify(selectedDemanda)) {
          setSelectedDemanda(updatedDemanda);
        }
      }
      // Sempre re-busca o histórico para garantir que novos eventos (como comentários ou ajustes) apareçam
      fetchHistoricoDemanda(selectedDemanda.id);
    }
  }, [demandas]);

  const handleAccept = async (demanda: any) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const valorFinal = demanda.valor_proposto_admin;
      const { error } = await supabase
        .from('prestador_demandas')
        .update({ 
          status: 'ativa', 
          data_inicio: new Date().toISOString(),
          valor_final: valorFinal
        })
        .eq('id', demanda.id);

      if (error) throw error;

      await demandService.addDemandHistory({
        demandaId: demanda.id,
        tipoEvento: 'aceite',
        motivo: `Proposta aceita pelo prestador. Serviço iniciado pelo valor de ${formatCurrency(valorFinal)}.`,
        prestadorOrigemId: prestadorId
      });

      await logService.logAction({
        ator_tipo: 'prestador',
        ator_id: prestadorId,
        ator_nome: prestadorNome,
        acao: 'ACEITAR_DEMANDA',
        detalhes: `Aceitou a demanda #${demanda.id.slice(0, 8)} pelo valor de ${formatCurrency(valorFinal)}`
      });

      // Add note to OS and notify client
      if (demanda.os_id) {
        await osService.addOSNote(
          demanda.os_id,
          demanda.ordem_servico?.cliente_id,
          'Serviço em execução pelo prestador.',
          demanda.ordem_servico?.codigo_os || 'N/A'
        );
      }

      // Notificar admin que o prestador aceitou
      await notificationService.notifyAdmin(
        '✅ Proposta Aceita pelo Prestador',
        `O prestador aceitou a demanda "${demanda.titulo || '#' + demanda.id.slice(0, 6)}" pelo valor de ${formatCurrency(valorFinal)}. O serviço foi iniciado.`,
        'servicos',
        'demanda_entregue',
        { itemId: demanda.id, prioridade: 'normal' }
      );

      toast.success('Demanda aceita com sucesso!');
      setIsModalOpen(false);
      fetchDemandas();
      refreshCounts();

    } catch (error) {
      console.error('Erro ao aceitar demanda:', error);
      toast.error('Erro ao aceitar demanda.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async (demanda: any) => {
    setConfirmModal({ isOpen: true, demanda });
  };

  const confirmReject = async () => {
    const demanda = confirmModal.demanda;
    if (!demanda || isSubmitting) return;
    if (!recusaMotivo.trim()) {
      toast.error('Informe o motivo da recusa.');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('prestador_demandas')
        .update({ status: 'aguardando_atribuicao', prestador_id: null })
        .eq('id', demanda.id);

      if (error) throw error;

      await demandService.addDemandHistory({
        demandaId: demanda.id,
        tipoEvento: 'recusa',
        motivo: `Proposta recusada pelo prestador. Motivo: ${recusaMotivo}`,
        prestadorOrigemId: prestadorId
      });

      await logService.logAction({
        ator_tipo: 'prestador',
        ator_id: prestadorId,
        ator_nome: prestadorNome,
        acao: 'RECUSAR_DEMANDA',
        detalhes: `Recusou a demanda #${demanda.id.slice(0, 8)}. Motivo: ${recusaMotivo}`
      });

      // Notificar admin que o prestador recusou
      await notificationService.notifyAdmin(
        '❌ Demanda Recusada pelo Prestador',
        `O prestador recusou a demanda "${demanda.titulo || '#' + demanda.id.slice(0, 6)}". Motivo: ${recusaMotivo}`,
        'demandas',
        'demanda_contraproposta_prestador',
        { itemId: demanda.id, prioridade: 'alta' }
      );

      toast.success('Demanda recusada.');
      setIsModalOpen(false);
      fetchDemandas();
      refreshCounts();

      setConfirmModal({ isOpen: false, demanda: null });
      setRecusaMotivo('');
    } catch (error) {
      console.error('Erro ao recusar demanda:', error);
      toast.error('Erro ao recusar demanda.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNegotiate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contrapropostaValor || isSubmitting) {
      if (!contrapropostaValor) toast.error('Informe o valor da contraproposta.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('prestador_demandas')
        .update({ 
          status: 'contraproposta_prestador',
          valor_proposto_prestador: parseFloat(contrapropostaValor),
          motivo_negociacao: contrapropostaMotivo
        })
        .eq('id', selectedDemanda.id);

      if (error) throw error;

      await demandService.addDemandHistory({
        demandaId: selectedDemanda.id,
        tipoEvento: 'negociacao',
        motivo: `Contraproposta do prestador: ${formatCurrency(parseFloat(contrapropostaValor))}. ${contrapropostaMotivo || ''}`,
        prestadorOrigemId: prestadorId,
        valorProposto: parseFloat(contrapropostaValor)
      });

      await logService.logAction({
        ator_tipo: 'prestador',
        ator_id: prestadorId,
        ator_nome: prestadorNome,
        acao: 'CONTRAPROPOSTA_DEMANDA',
        detalhes: `Enviou contraproposta de ${formatCurrency(parseFloat(contrapropostaValor))} para a demanda #${selectedDemanda.id.slice(0, 8)}`
      });

      // Notificar admin da contraproposta do prestador
      await notificationService.notifyAdmin(
        '⚡ Contraproposta Recebida do Prestador',
        `O prestador enviou uma contraproposta de ${formatCurrency(parseFloat(contrapropostaValor))} para a demanda "${selectedDemanda.titulo || '#' + selectedDemanda.id.slice(0, 6)}". Acesse a Gestão Interna para responder.`,
        'demandas',
        'demanda_contraproposta_prestador',
        { itemId: selectedDemanda.id, prioridade: 'alta' }
      );

      toast.success('Contraproposta enviada com sucesso!');
      setIsNegotiating(false);
      setIsModalOpen(false);
      fetchDemandas();
      refreshCounts();

    } catch (error) {
      console.error('Erro ao enviar contraproposta:', error);
      toast.error('Erro ao enviar contraproposta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeliver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dataEntrega || isSubmitting) {
      if (!dataEntrega) toast.error('Informe a data da entrega.');
      return;
    }

    setIsSubmitting(true);
    const urls: string[] = [];

    try {
      if (arquivosResultado.length > 0) {
        for (const file of arquivosResultado) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${prestadorId}/${selectedDemanda.id}/entrega_${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
          const { error: uploadError } = await supabase.storage.from('entregas_demandas').upload(fileName, file);
          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage.from('entregas_demandas').getPublicUrl(fileName);
            urls.push(publicUrl);
          }
        }
      }

      const updateData: any = {
        status: 'em_analise',
        data_entrega_prestador: new Date(dataEntrega).toISOString(),
        observacao_entrega: observacaoEntrega,
        link_resultado: linkResultado,
        arquivos_resultado: urls
      };

      if (selectedDemanda.status_ajuste === 'solicitado') {
        updateData.status_ajuste = 'entregue';
      }

      const { error } = await supabase
        .from('prestador_demandas')
        .update(updateData)
        .eq('id', selectedDemanda.id);

      if (error) {
        if (error.message?.includes('data_entrega_prestador') || error.message?.includes('observacao_entrega')) {
          // Fallback if update columns are missing
          const fallbackData: any = { status: 'em_analise' };
          if (selectedDemanda.status_ajuste === 'solicitado') {
            fallbackData.status_ajuste = 'entregue';
          }
          // try to update link_resultado and arquivos_resultado if they exist
          try {
             await supabase.from('prestador_demandas').update({ link_resultado: linkResultado, arquivos_resultado: urls }).eq('id', selectedDemanda.id);
          } catch (e) {
             // ignore if column doesn't exist
          }
          const { error: fallbackError } = await supabase
            .from('prestador_demandas')
            .update(fallbackData)
            .eq('id', selectedDemanda.id);
          
          if (fallbackError) throw fallbackError;
        } else {
          throw error;
        }
      }

      await demandService.addDemandHistory({
        demandaId: selectedDemanda.id,
        tipoEvento: 'entrega',
        motivo: `Entrega realizada pelo prestador. ${observacaoEntrega || ''}${urls.length > 0 ? '\n\nAnexos: ' + urls.join(', ') : ''}${linkResultado ? '\n\nLink: ' + linkResultado : ''}`,
        prestadorOrigemId: prestadorId
      });

      await logService.logAction({
        ator_tipo: 'prestador',
        ator_id: prestadorId,
        ator_nome: prestadorNome,
        acao: 'ENTREGAR_DEMANDA',
        detalhes: `Realizou a entrega da demanda #${selectedDemanda.id.slice(0, 8)}`
      });

      // Add note to OS
      if (selectedDemanda.os_id) {
        await supabase.from('os_notas').insert({
          os_id: selectedDemanda.os_id,
          nota: 'Serviço entregue pelo prestador e em análise pela administração.'
        });
      }

      await notificationService.notifyAdmin(
        '✅ Demanda Entregue',
        `O prestador entregou a demanda "${selectedDemanda.titulo || '#' + selectedDemanda.id.slice(0, 6)}" e aguarda análise.`,
        'demandas', 'demanda_entregue',
        { itemId: selectedDemanda.id, prioridade: 'alta' }
      );

      toast.success('Entrega realizada com sucesso! Aguardando análise do administrador.');
      setIsDelivering(false);
      setIsModalOpen(false);
      setLinkResultado('');
      setArquivosResultado([]);
      fetchDemandas();
      refreshCounts();

    } catch (error) {
      console.error('Erro ao registrar entrega:', error);
      toast.error('Erro ao registrar entrega.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTransferToAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDemanda || isSubmitting) return;
    if (!transferReason) {
      toast.error('Informe o motivo da transferência.');
      return;
    }

    setIsSubmitting(true);
    try {
      const urls: string[] = [];
      if (arquivosTransferencia.length > 0) {
        for (const file of arquivosTransferencia) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${prestadorId}/${selectedDemanda.id}/transfer_${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
          const { error: uploadError } = await supabase.storage.from('entregas_demandas').upload(fileName, file);
          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage.from('entregas_demandas').getPublicUrl(fileName);
            urls.push(publicUrl);
          }
        }
      }

      const { error: updateError } = await supabase
        .from('prestador_demandas')
        .update({
          prestador_id: null,
          status: 'ativa', // Volta para ser serviço interno/aberto para reatribuição
          valor_final: selectedDemanda.valor_proposto_admin, // Mantém o valor original do adm como referência
          detalhes: `${selectedDemanda.detalhes || selectedDemanda.descricao || ''}\n\n--- TRANSFERÊNCIA (DEVOLUÇÃO) ---\nMotivo: ${transferReason}`,
          arquivos_transferencia: urls
        })
        .eq('id', selectedDemanda.id);

      if (updateError) throw updateError;

      await demandService.addDemandHistory({
        demandaId: selectedDemanda.id,
        tipoEvento: 'transferencia',
        motivo: `Demanda transferida de volta para a Equipe Interna. Motivo: ${transferReason}${urls.length > 0 ? '\n\nArquivos Anexados: ' + urls.join(', ') : ''}`,
        prestadorOrigemId: prestadorId
      });

      await logService.logAction({
        ator_tipo: 'prestador',
        ator_id: prestadorId,
        ator_nome: prestadorNome,
        acao: 'TRANSFERIR_DEMANDA',
        detalhes: `Transferiu a demanda #${selectedDemanda.id.slice(0, 8)} de volta para a administração. Motivo: ${transferReason}`
      });

      // Log in os_notas
      await supabase.from('os_notas').insert({
        os_id: selectedDemanda.os_id,
        nota: `Demanda transferida de "Equipe Externa" para "Equipe Interna".`
      });

      await notificationService.notifyAdmin(
        '🔄 Demanda Devolvida',
        `O prestador devolveu a demanda "${selectedDemanda.titulo || '#' + selectedDemanda.id.slice(0, 6)}" para a Equipe Interna.`,
        'demandas', 'demanda_transferida',
        { itemId: selectedDemanda.id, prioridade: 'alta' }
      );

      toast.success('Demanda transferida para a administração com sucesso!');
      setIsTransferring(false);
      setIsModalOpen(false);
      fetchDemandas();

    } catch (error) {
      console.error('Erro ao transferir para adm:', error);
      toast.error('Erro ao transferir demanda.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendSupport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportMessage || isSubmitting) {
      if (!supportMessage) toast.error('Informe a mensagem de suporte.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('prestador_suporte_demandas')
        .insert({
          demanda_id: selectedDemanda.id,
          prestador_id: prestadorId,
          mensagem: supportMessage,
          status: 'aberto'
        });

      if (error) {
        if (error.code === 'PGRST205') {
          toast.error('O sistema de suporte para demandas ainda não está configurado no banco de dados. Contate o administrador.');
          return;
        }
        throw error;
      }

      toast.success('Solicitação de suporte enviada com sucesso!');
      setIsSupportModalOpen(false);
      setSupportMessage('');
    } catch (error) {
      console.error('Erro ao enviar suporte:', error);
      toast.error('Erro ao enviar solicitação de suporte.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredDemandas = demandas.filter(d => {
    if (activeTab === 'abertas') return ['aberta', 'em_negociacao', 'contraproposta_prestador', 'contraproposta_admin_final'].includes(d.status);
    if (activeTab === 'ativas') return ['ativa', 'em_analise', 'em_ajuste'].includes(d.status);
    if (activeTab === 'concluidas') return ['concluida', 'finalizada', 'cancelada', 'concluida_interna'].includes(d.status);
    return true;
  });

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1a1a1a] border-t-transparent"></div>
      </div>
    );
  }

  // Helper: formata o valor da contraproposta
  const contraprostaValorFormatado = (val: string) => {
    if (!val) return '';
    const num = parseFloat(val);
    if (isNaN(num)) return '';
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <>
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex border-b border-neutral-200">
        <button
          onClick={() => setActiveTab('abertas')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'abertas' ? 'border-[#1a1a1a] text-[#1a1a1a]' : 'border-transparent text-neutral-500 hover:text-neutral-700'
          }`}
        >
          Abertas
          {pendencies.moduleDemandasAbertas > 0 && (
            <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[8px] font-black text-white ring-1 ring-white/20 animate-pulse">
              {pendencies.moduleDemandasAbertas}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('ativas')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'ativas' ? 'border-[#1a1a1a] text-[#1a1a1a]' : 'border-transparent text-neutral-500 hover:text-neutral-700'
          }`}
        >
          Ativas
          {pendencies.moduleDemandasAtivas > 0 && (
            <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-amber-500 px-1 text-[8px] font-black text-white ring-1 ring-white/20">
              {pendencies.moduleDemandasAtivas}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('concluidas')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'concluidas' ? 'border-[#1a1a1a] text-[#1a1a1a]' : 'border-transparent text-neutral-500 hover:text-neutral-700'
          }`}
        >
          Concluídas
        </button>
      </div>

      {filteredDemandas.length === 0 ? (
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5 text-center text-neutral-500">
          Nenhuma demanda encontrada nesta aba.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredDemandas.map((demanda) => (
            <div 
              id={`demanda-${demanda.id}`}
              key={demanda.id} 
              className={`flex flex-col rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5 transition-all duration-500 ${
                highlightedItemId === demanda.id 
                  ? 'bg-indigo-50/10 ring-2 ring-indigo-500 scale-[1.02] z-10 shadow-lg' 
                  : 'hover:shadow-md'
              }`}
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-lg bg-indigo-50 px-2.5 py-1 text-[10px] font-black text-indigo-700 ring-1 ring-inset ring-indigo-600/10">
                      {demanda.codigo_demanda || `#${demanda.id?.slice(0, 8)}`}
                    </span>
                    <span className="inline-flex items-center rounded-lg bg-neutral-100 px-2.5 py-1 text-[10px] font-bold text-neutral-600 ring-1 ring-inset ring-neutral-200">
                      {demanda.ordem_servico?.codigo_os || 'N/A'}
                    </span>
                  </div>
                  <h3 className="mt-2 font-medium text-neutral-900">
                    {demanda.ordem_servico?.orcamento?.servico?.nome || demanda.titulo}
                  </h3>
                </div>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  demanda.status === 'em_negociacao' ? 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20' :
                  demanda.status === 'contraproposta_prestador' ? 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20' :
                  demanda.status === 'contraproposta_admin_final' ? 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/20' :
                  demanda.status === 'ativa' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20' :
                  demanda.status === 'em_analise' ? 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/20' :
                  demanda.status === 'em_ajuste' ? 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/20' :
                  demanda.status === 'concluida' || demanda.status === 'finalizada' || demanda.status === 'concluida_interna' ? 'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/20' :
                  demanda.status === 'cancelada' ? 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20' :
                  'bg-neutral-50 text-neutral-700 ring-1 ring-inset ring-neutral-600/20'
                }`}>
                  {demanda.status === 'concluida_interna' ? 'Aprovada' : (demanda.status?.replace(/_/g, ' ') || '—')}
                </span>
              </div>

              <p className="mb-4 text-sm text-neutral-600 line-clamp-2 flex-grow">
                {demanda.detalhes || demanda.descricao || 'Sem descrição'}
              </p>

              <div className="mb-4 rounded-lg bg-neutral-50 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-500">Valor:</span>
                  <span className="font-medium text-neutral-900">
                    {formatCurrency(demanda.valor_final || demanda.valor_proposto_admin || 0)}
                  </span>
                </div>
                {demanda.prazo_entrega && (
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-neutral-500">Prazo:</span>
                    <span className="font-medium text-neutral-900">
                      {formatDateTime(demanda.prazo_entrega)}
                    </span>
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  setSelectedDemanda(demanda);
                  setIsModalOpen(true);
                  setIsNegotiating(false);
                  setIsDelivering(false);
                  fetchHistoricoDemanda(demanda.id);
                }}
                className="mt-auto flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-200"
              >
                <FileText className="h-4 w-4" />
                Ver Detalhes
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedDemanda(null);
          setIsDelivering(false);
          setLinkResultado('');
          setArquivosResultado([]);
          setArquivosTransferencia([]);
        }}
        title="Detalhes da Demanda"
        size="full"
      >
        {selectedDemanda && (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 border-b border-neutral-100 pb-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
                    <FileText className="h-6 w-6 text-indigo-600" />
                    {selectedDemanda.ordem_servico?.orcamento?.servico?.nome || selectedDemanda.titulo}
                  </h4>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-1 text-xs font-bold text-purple-700 ring-1 ring-purple-100">
                      {selectedDemanda.codigo_demanda || `#${selectedDemanda.id?.slice(0, 8)}`}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-600">
                      OS: {selectedDemanda.ordem_servico?.codigo_os || 'N/A'}
                    </span>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      selectedDemanda.status === 'em_negociacao' ? 'bg-amber-100 text-amber-800' :
                      selectedDemanda.status === 'contraproposta_prestador' ? 'bg-blue-100 text-blue-800' :
                      selectedDemanda.status === 'contraproposta_admin_final' ? 'bg-orange-100 text-orange-800' :
                      selectedDemanda.status === 'ativa' ? 'bg-emerald-100 text-emerald-800' :
                      selectedDemanda.status === 'em_analise' ? 'bg-indigo-100 text-indigo-800' :
                      selectedDemanda.status === 'em_ajuste' ? 'bg-orange-100 text-orange-800' :
                      selectedDemanda.status === 'concluida' || selectedDemanda.status === 'finalizada' || selectedDemanda.status === 'concluida_interna' ? 'bg-purple-100 text-purple-800' :
                      selectedDemanda.status === 'cancelada' ? 'bg-red-100 text-red-800' :
                      'bg-neutral-100 text-neutral-800'
                    }`}>
                      {selectedDemanda.status === 'concluida_interna' ? 'APROVADA' : (selectedDemanda.status?.replace(/_/g, ' ') || '—').toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                    <DollarSign className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-neutral-500">Valor Proposto</span>
                    <span className="block text-lg font-bold text-neutral-900">
                      {formatCurrency(selectedDemanda.valor_proposto_admin || 0)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-neutral-500">Prazo de Entrega</span>
                    <span className="block text-sm font-bold text-neutral-900">
                      {selectedDemanda.prazo_entrega ? formatDateTime(selectedDemanda.prazo_entrega) : 'Não definido'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
              <div className="border-b border-neutral-100 bg-neutral-50 px-4 py-3 flex items-center gap-2">
                <AlignLeft className="h-4 w-4 text-neutral-500" />
                <h5 className="text-sm font-semibold text-neutral-700">Descrição Original</h5>
              </div>
              <div className="p-4">
                <p className="text-sm text-neutral-600 whitespace-pre-wrap leading-relaxed">
                  {selectedDemanda.descricao || 'Nenhuma descrição fornecida.'}
                </p>
              </div>
            </div>

            {/* Anexos e Arquivos — Movido para fora para maior visibilidade */}
            {( (selectedDemanda.arquivos_briefing && Array.isArray(selectedDemanda.arquivos_briefing) && selectedDemanda.arquivos_briefing.length > 0) || 
               (selectedDemanda.arquivos_transferencia && Array.isArray(selectedDemanda.arquivos_transferencia) && selectedDemanda.arquivos_transferencia.length > 0) ) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedDemanda.arquivos_briefing && Array.isArray(selectedDemanda.arquivos_briefing) && selectedDemanda.arquivos_briefing.map((item: any, i: number) => {
                  const url = typeof item === 'string' ? item : item.url;
                  const nome = typeof item === 'string' ? `Briefing ${i + 1}` : item.nome || `Briefing ${i + 1}`;
                  return (
                    <a key={`brief-${i}`} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl bg-indigo-50 border border-indigo-100 p-4 hover:bg-indigo-100 transition-all">
                      <Upload className="h-5 w-5 text-indigo-600 shrink-0" />
                      <div className="overflow-hidden">
                        <p className="text-xs font-black text-indigo-800 truncate" title={nome}>{nome}</p>
                        <p className="text-[10px] text-indigo-500">Anexo do Cliente</p>
                      </div>
                    </a>
                  );
                })}
                {selectedDemanda.arquivos_transferencia && Array.isArray(selectedDemanda.arquivos_transferencia) && selectedDemanda.arquivos_transferencia.map((url: string, i: number) => (
                  <a key={`trans-${i}`} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-100 p-4 hover:bg-amber-100 transition-all">
                    <Upload className="h-5 w-5 text-amber-600 shrink-0" />
                    <div className="overflow-hidden">
                      <p className="text-xs font-black text-amber-800 truncate">Anexo de Transferência {i + 1}</p>
                      <p className="text-[10px] text-amber-500">Documento Administrativo</p>
                    </div>
                  </a>
                ))}
              </div>
            )}

            {selectedDemanda.status === 'cancelada' && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-5 shadow-sm">
                <div className="flex items-center gap-2 text-red-800 mb-2">
                  <XCircle className="h-5 w-5" />
                  <h5 className="font-bold">Demanda Cancelada pela Administração</h5>
                </div>
                <p className="text-sm text-red-700 leading-relaxed">
                  Esta demanda foi encerrada administrativamente. 
                  {selectedDemanda.ordem_servico?.motivo_cancelamento ? (
                    <>
                      <br /><br />
                      <span className="font-bold uppercase text-[10px] tracking-wider opacity-60">Motivo do Cancelamento:</span>
                      <br />
                      <span className="text-sm italic">"{selectedDemanda.ordem_servico.motivo_cancelamento}"</span>
                    </>
                  ) : (
                    <span className="italic block mt-1">Nenhum motivo detalhado foi fornecido no cancelamento.</span>
                  )}
                </p>
              </div>
            )}

            {(selectedDemanda.detalhes || historicoDemanda.length > 0) && (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 overflow-hidden shadow-sm">
                <div className="border-b border-indigo-100 bg-indigo-50 px-4 py-3 flex items-center gap-2">
                  <Info className="h-4 w-4 text-indigo-600" />
                  <h5 className="text-sm font-semibold text-indigo-900">Detalhes do Direcionamento</h5>
                </div>
                <div className="p-4 space-y-6 text-left">
                  {/* Contexto da Demanda */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white/60 p-4 rounded-xl border border-indigo-100 shadow-sm">
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Informações de Direcionamento</p>
                      <div className="space-y-1.5">
                        <p className="text-xs font-bold text-indigo-900 flex items-center gap-2">
                          <span className="w-20 text-indigo-400 font-medium">Demanda:</span>
                          <span className="font-mono bg-indigo-50 px-1.5 py-0.5 rounded text-indigo-600">{selectedDemanda.codigo_demanda || `#${selectedDemanda.id.slice(0, 8)}`}</span>
                        </p>
                        {selectedDemanda.ordem_servico?.codigo_os && (
                          <p className="text-xs font-bold text-indigo-900 flex items-center gap-2">
                            <span className="w-20 text-indigo-400 font-medium">OS:</span>
                            <span className="font-mono text-indigo-600">{selectedDemanda.ordem_servico.codigo_os}</span>
                          </p>
                        )}
                        {selectedDemanda.ordem_servico?.cliente?.nome && (
                          <p className="text-xs font-bold text-indigo-900 flex items-center gap-2">
                            <span className="w-20 text-indigo-400 font-medium">Cliente:</span>
                            <span className="text-indigo-600 truncate">{selectedDemanda.ordem_servico.cliente.nome}</span>
                          </p>
                        )}
                      </div>
                    </div>
                    {selectedDemanda.detalhes && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Detalhes do Orçamento</p>
                        <p className="text-xs text-indigo-800 leading-relaxed italic bg-indigo-50/50 p-3 rounded-lg border border-indigo-100/50">
                          {selectedDemanda.detalhes}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Histórico Cronológico Estruturado */}
                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                        <History className="h-4 w-4" /> Histórico Operacional Completo
                      </p>
                      <span className="text-[10px] font-bold text-indigo-400 uppercase">Audit Trail</span>
                    </div>
                    
                    <div className="relative border-l-2 border-indigo-100 ml-3 pl-6 space-y-8 py-2">
                      {/* Eventos Dinâmicos do Histórico */}

                      {/* Eventos Dinâmicos do Histórico */}
                      {historicoDemanda.map((h, i) => {
                        const config = {
                          criacao: { label: '🆕 ABERTURA DA DEMANDA', color: 'bg-indigo-50 text-indigo-600', icon: '🆕', borderColor: 'border-indigo-100' },
                          transferencia: { label: '🔄 DIRECIONAMENTO / PROPOSTA', color: 'bg-blue-100 text-blue-700', icon: '↔', borderColor: 'border-blue-200' },
                          aceite: { label: '✅ ACEITE DA DEMANDA', color: 'bg-emerald-100 text-emerald-700', icon: '✓', borderColor: 'border-emerald-200' },
                          entrega: { label: '📤 ENTREGA PARA ANÁLISE', color: 'bg-purple-100 text-purple-700', icon: '⬆', borderColor: 'border-purple-200' },
                          ajuste: { label: '⚠️ SOLICITAÇÃO DE AJUSTE', color: 'bg-orange-100 text-orange-700', icon: '⚠', borderColor: 'border-orange-200' },
                          recusa: { label: '❌ RECUSA / DEVOLUÇÃO', color: 'bg-red-100 text-red-700', icon: '✕', borderColor: 'border-red-200' },
                          negociacao: { label: '💬 NEGOCIAÇÃO DE VALORES', color: 'bg-amber-100 text-amber-700', icon: '$', borderColor: 'border-amber-200' },
                          finalizacao: { label: '🏁 FINALIZAÇÃO', color: 'bg-emerald-600 text-white', icon: '✓', borderColor: 'border-emerald-500' },
                          cancelamento: { label: '🚫 CANCELAMENTO', color: 'bg-red-600 text-white', icon: '✕', borderColor: 'border-red-500' }
                        }[h.tipo_evento] || { label: h.tipo_evento?.toUpperCase() || 'EVENTO', color: 'bg-neutral-100 text-neutral-600', icon: '•', borderColor: 'border-neutral-200' };

                        return (
                          <div key={i} className="relative animate-in fade-in slide-in-from-left-4" style={{ animationDelay: `${(i + 1) * 100}ms` }}>
                            <div className={`absolute -left-[31px] top-0 h-4 w-4 rounded-full ${config.color.split(' ')[0]} ring-4 ring-indigo-50 flex items-center justify-center text-[8px] font-black`}>
                              <span className={config.color.split(' ')[1]}>{config.icon}</span>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className={`text-[11px] font-black uppercase tracking-tight ${config.color.split(' ')[1]}`}>{config.label}</p>
                                {h.motivo?.includes('R$') && (
                                  <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-white border border-indigo-100 text-indigo-600">
                                    {h.motivo.match(/R\$\s?[\d.,]+/)?.[0]}
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] font-bold text-indigo-400 mt-0.5 flex items-center gap-1.5">
                                {new Date(h.created_at).toLocaleString('pt-BR')} 
                                {(h.origem?.nome || h.origem_prestador?.nome_razao) && (
                                  <>
                                    <span className="w-1 h-1 rounded-full bg-indigo-200" />
                                    <span className="text-indigo-400/80">Por: {h.origem?.nome || h.origem_prestador?.nome_razao}</span>
                                  </>
                                )}
                              </p>
                              {h.motivo && (
                                <div className={`mt-2 p-3 rounded-xl border ${config.borderColor} bg-white/80 shadow-sm`}>
                                  <p className="text-xs text-indigo-900 leading-relaxed whitespace-pre-wrap">{h.motivo}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Marco: Início de Execução */}
                      {selectedDemanda.data_inicio && (
                        <div className="relative animate-in fade-in slide-in-from-left-4">
                          <div className="absolute -left-[31px] top-0 h-4 w-4 rounded-full bg-emerald-100 ring-4 ring-indigo-50 flex items-center justify-center">
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                          </div>
                          <div>
                            <p className="text-[11px] font-black text-emerald-900 uppercase tracking-tight">▶ EXECUÇÃO EM ANDAMENTO</p>
                            <p className="text-[10px] font-bold text-emerald-400 mt-0.5">{new Date(selectedDemanda.data_inicio).toLocaleString('pt-BR')}</p>
                            <p className="text-xs text-emerald-700/70 mt-1 font-medium italic">O cronômetro de execução está ativo para esta demanda.</p>
                          </div>
                        </div>
                      )}

                      {/* Marco: Conclusão / Pagamento */}
                      {(selectedDemanda.status === 'concluida' || selectedDemanda.status === 'finalizada' || selectedDemanda.data_conclusao) && (
                        <div className="relative animate-in fade-in slide-in-from-left-4">
                          <div className="absolute -left-[31px] top-0 h-4 w-4 rounded-full bg-emerald-600 ring-4 ring-indigo-50 flex items-center justify-center">
                            <CheckCircle className="h-2.5 w-2.5 text-white" />
                          </div>
                          <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 shadow-sm">
                            <p className="text-[11px] font-black text-emerald-900 uppercase tracking-tight">🏁 FINALIZADA E LIQUIDADA</p>
                            <p className="text-[10px] font-black text-emerald-500 mt-0.5">
                              {selectedDemanda.data_conclusao ? new Date(selectedDemanda.data_conclusao).toLocaleString('pt-BR') : '—'}
                            </p>
                            {selectedDemanda.valor_final > 0 && (
                              <div className="mt-3 pt-3 border-t border-emerald-200/50 flex items-center justify-between">
                                <span className="text-[10px] font-black text-emerald-600 uppercase">Valor Final Liquidado</span>
                                <span className="text-sm font-black text-emerald-700">{formatCurrency(selectedDemanda.valor_final)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            )}

            {selectedDemanda.status_ajuste === 'solicitado' && (
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
                <h5 className="text-sm font-medium text-orange-900 mb-2 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Ajuste Solicitado pela Administração
                </h5>
                <p className="text-sm text-orange-800 mb-3 whitespace-pre-wrap">
                  {selectedDemanda.ajuste_solicitado}
                </p>
                {selectedDemanda.prazo_ajuste && (
                  <p className="text-sm text-orange-800 font-medium">
                    Prazo para Reenvio: {formatDateTime(selectedDemanda.prazo_ajuste)}
                  </p>
                )}
              </div>
            )}



            {/* Ações para demanda em negociação ou contraproposta final */}
            {(selectedDemanda.status === 'em_negociacao' || selectedDemanda.status === 'contraproposta_admin_final') && !isNegotiating && (
              <div className="space-y-4 pt-4 border-t border-neutral-100">
                {/* Linha do Tempo da Negociação */}
                <div className="space-y-3 bg-neutral-50/50 p-4 rounded-xl border border-neutral-100">
                  <h5 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">Histórico de Lances</h5>
                  
                  {/* Lance 1: Oferta Original do Admin */}
                  <div className="flex flex-col items-start gap-1">
                    <span className="text-xs font-medium text-neutral-500">Administração</span>
                    <div className="bg-white px-4 py-2 rounded-2xl rounded-tl-none border border-neutral-200 shadow-sm max-w-[80%]">
                      <p className="text-sm text-neutral-800">Ofereceu: <strong>{formatCurrency(selectedDemanda.valor_proposto_admin)}</strong></p>
                    </div>
                  </div>

                  {/* Lance 2: Contraproposta do Prestador (Se existir) */}
                  {selectedDemanda.valor_proposto_prestador && (
                    <div className="flex flex-col items-end gap-1 mt-2">
                      <span className="text-xs font-medium text-neutral-500">Você</span>
                      <div className="bg-indigo-600 px-4 py-2 rounded-2xl rounded-tr-none shadow-sm max-w-[80%] text-white">
                        <p className="text-sm">Pediu: <strong>{formatCurrency(selectedDemanda.valor_proposto_prestador)}</strong></p>
                        {selectedDemanda.motivo_negociacao && selectedDemanda.status !== 'contraproposta_admin_final' && (
                          <p className="text-xs text-indigo-100 opacity-90 mt-1 italic">"{selectedDemanda.motivo_negociacao}"</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Lance 3: Contraproposta Final do Admin */}
                  {selectedDemanda.status === 'contraproposta_admin_final' && (
                    <div className="flex flex-col items-start gap-1 mt-2">
                      <span className="text-xs font-medium text-neutral-500">Administração (Lance Final)</span>
                      <div className="bg-orange-50 px-4 py-2 rounded-2xl rounded-tl-none border border-orange-200 shadow-sm max-w-[80%]">
                        <p className="text-sm text-orange-900">Novo Valor: <strong>{formatCurrency(selectedDemanda.valor_proposto_admin)}</strong></p>
                        {selectedDemanda.motivo_negociacao && (
                          <p className="text-xs text-orange-800 opacity-90 mt-1 italic">"{selectedDemanda.motivo_negociacao}"</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  {selectedDemanda.status === 'em_negociacao' && (
                    <button
                      onClick={() => setIsNegotiating(true)}
                      className="flex-1 inline-flex justify-center items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                    >
                      <MessageSquare className="h-4 w-4" />
                      Negociar
                    </button>
                  )}
                  <button
                    onClick={() => handleReject(selectedDemanda)}
                    disabled={isSubmitting}
                    className="flex-1 inline-flex justify-center items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    <XCircle className="h-4 w-4" />
                    Recusar
                  </button>
                  <button
                    onClick={() => handleAccept(selectedDemanda)}
                    disabled={isSubmitting}
                    className="flex-1 inline-flex justify-center items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Aprovar
                  </button>
                </div>
              </div>
            )}

            {/* Formulário de Negociação */}
            {isNegotiating && (
              <form onSubmit={handleNegotiate} className="space-y-4 pt-4 border-t border-neutral-100">
                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                  <h5 className="text-sm font-bold text-indigo-900 mb-3 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" /> Enviar Contraproposta
                  </h5>
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-indigo-800">
                        Qual o seu valor desejado? (R$) *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-indigo-400">R$</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          required
                          value={contraprostaValorFormatado(contrapropostaValor)}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\D/g, '');
                            setContrapropostaValor(raw ? (parseInt(raw) / 100).toString() : '');
                          }}
                          className="w-full rounded-lg border border-indigo-200 text-sm focus:border-indigo-500 focus:ring-indigo-500 p-2.5 pl-9 font-bold"
                          placeholder="0,00"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-indigo-800">
                        Justificativa (Opcional, mas recomendado)
                      </label>
                      <textarea
                        rows={2}
                        value={contrapropostaMotivo}
                        onChange={(e) => setContrapropostaMotivo(e.target.value)}
                        className="w-full rounded-lg border-indigo-200 text-sm focus:border-indigo-500 focus:ring-indigo-500 p-2.5"
                        placeholder="Ex: Considerando a distância e o material necessário..."
                      />
                    </div>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsNegotiating(false)}
                    className="rounded-lg px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors shadow-md disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSubmitting ? 'Enviando...' : 'Enviar Lance'}
                  </button>
                </div>
              </form>
            )}

            {/* Ações para demanda ativa, em_ajuste ou em_analise */}
            {(selectedDemanda.status === 'ativa' || selectedDemanda.status === 'em_ajuste' || selectedDemanda.status === 'em_analise') && !isDelivering && !isTransferring && (
              <div className="flex flex-col gap-2 pt-4 border-t border-neutral-100">
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => !isSubmitting && handleOpenSupport(selectedDemanda)}
                    disabled={isSubmitting}
                    className="flex-1 inline-flex justify-center items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                  >
                    <MessageSquare className="h-4 w-4" />
                    Suporte
                  </button>
                  {selectedDemanda.status !== 'em_analise' && (
                    <button
                      onClick={() => !isSubmitting && setIsDelivering(true)}
                      disabled={isSubmitting}
                      className="flex-1 inline-flex justify-center items-center gap-2 rounded-lg bg-[#1a1a1a] px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-50"
                    >
                      <Upload className="h-4 w-4" />
                      Entregar Demanda
                    </button>
                  )}
                </div>
                {selectedDemanda.status !== 'em_analise' && (
                  <button
                    onClick={() => {
                      if (isSubmitting) return;
                      setTransferReason('');
                      setArquivosTransferencia([]);
                      setIsTransferring(true);
                      setIsModalOpen(false); // Fecha o modal de detalhes para abrir o de transferência
                    }}
                    className="w-full inline-flex justify-center items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
                  >
                    <XCircle className="h-4 w-4" />
                    Transferir para Administração (Adm)
                  </button>
                )}
              </div>
            )}


            {/* Formulário de Entrega Premium */}
            {isDelivering && (
              <form onSubmit={handleDeliver} className="space-y-6 pt-6 border-t border-neutral-100 animate-in fade-in slide-in-from-bottom-4">
                <div className="flex items-center gap-3 mb-6 bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                  <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                    <Send className="h-5 w-5" />
                  </div>
                  <div>
                    <h5 className="text-sm font-black text-emerald-900 uppercase tracking-tight">Finalização de Entrega</h5>
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Preencha os detalhes do resultado final</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Informações Básicas */}
                  <div className="space-y-6">
                    <div className="rounded-2xl bg-neutral-50 p-5 ring-1 ring-black/5 hover:ring-indigo-200 transition-all group">
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-neutral-400 group-hover:text-indigo-500 transition-colors flex items-center gap-2">
                        <Calendar className="h-3 w-3" /> Data e Hora da Entrega *
                      </label>
                      <input
                        type="datetime-local"
                        required
                        value={dataEntrega}
                        onChange={(e) => setDataEntrega(e.target.value)}
                        className="w-full rounded-xl border-none bg-white p-3 text-sm font-bold text-neutral-900 shadow-sm focus:ring-2 focus:ring-indigo-500 transition-all font-mono"
                      />
                    </div>

                    <div className="rounded-2xl bg-neutral-50 p-5 ring-1 ring-black/5 hover:ring-indigo-200 transition-all group">
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-neutral-400 group-hover:text-indigo-500 transition-colors flex items-center gap-2">
                        <MessageSquare className="h-3 w-3" /> Observações (Opcional)
                      </label>
                      <textarea
                        rows={4}
                        value={observacaoEntrega}
                        onChange={(e) => setObservacaoEntrega(e.target.value)}
                        className="w-full rounded-xl border-none bg-white p-3 text-sm font-medium text-neutral-700 shadow-sm focus:ring-2 focus:ring-indigo-500 transition-all"
                        placeholder="Descreva detalhes importantes sobre o serviço entregue..."
                      />
                    </div>
                  </div>

                  {/* Mídia e Arquivos */}
                  <div className="space-y-6">
                    <div className="rounded-2xl bg-white p-5 ring-1 ring-black/5 border border-indigo-50 shadow-sm">
                      <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Upload className="h-3 w-3" /> Mídia da Entrega
                      </p>
                      
                      <div className="space-y-4">
                        <div className="relative">
                          <label className="mb-1 block text-[10px] font-bold text-neutral-400 uppercase">Link de Acesso (Drive/Dropbox)</label>
                          <input
                            type="url"
                            value={linkResultado}
                            onChange={(e) => setLinkResultado(e.target.value)}
                            className="w-full rounded-xl border-neutral-200 bg-neutral-50 p-3 pl-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all"
                            placeholder="https://..."
                          />
                        </div>

                        <div className="relative">
                          <label className="mb-1 block text-[10px] font-bold text-neutral-400 uppercase">Upload de Arquivos (Máx 5)</label>
                          {arquivosResultado.length > 0 && (
                            <div className="mb-3 space-y-2">
                              {arquivosResultado.map((f, i) => (
                                <div key={i} className="flex items-center gap-2 bg-emerald-50 rounded-xl px-3 py-2 border border-emerald-100">
                                  <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                                  <span className="text-xs font-bold text-emerald-700 truncate flex-1">{f.name}</span>
                                  <button type="button" onClick={() => setArquivosResultado(prev => prev.filter((_, idx) => idx !== i))} className="text-emerald-500 hover:text-emerald-700">
                                    <XCircle className="h-4 w-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          {arquivosResultado.length < 5 && (
                            <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-neutral-200 bg-neutral-50 p-6 hover:bg-indigo-50/30 hover:border-indigo-300 transition-all">
                              <div className="flex flex-col items-center text-center">
                                <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center mb-3">
                                  <Upload className="h-5 w-5 text-indigo-400" />
                                </div>
                                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">Anexar Arquivos</span>
                                <span className="text-[10px] text-neutral-400 uppercase font-bold">{arquivosResultado.length}/5 selecionados</span>
                              </div>
                              <input 
                                type="file" 
                                multiple 
                                className="sr-only" 
                                onChange={(e) => {
                                  const files = Array.from(e.target.files || []);
                                  setArquivosResultado(prev => [...prev, ...files].slice(0, 5));
                                }} 
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end items-center gap-4 pt-4 border-t border-neutral-100">
                  <button
                    type="button"
                    onClick={() => setIsDelivering(false)}
                    className="rounded-xl px-6 py-3 text-xs font-black uppercase tracking-widest text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 transition-all"
                  >
                    Voltar aos Detalhes
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-3 rounded-xl bg-emerald-600 px-8 py-3 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-emerald-200 hover:bg-emerald-700 transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        Confirmar e Entregar
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

          </div>
        )}
      </Modal>

      {/* Modal de Suporte (Chat em tempo real com Admin) */}
      <Modal
        isOpen={isSupportModalOpen}
        onClose={() => setIsSupportModalOpen(false)}
        title="💬 Chat com Administração"
        size="full"
      >
        {selectedDemanda && (
          <div className="h-[500px]">
            <DemandasComentarios
              demandaId={selectedDemanda.id}
              autorId={prestadorId}
              autorNome={prestadorNome}
              autorTipo="prestador"
            />
          </div>
        )}
      </Modal>
      {/* Modal de Transferência Dedicado */}
      <Modal
        isOpen={isTransferring}
        onClose={() => setIsTransferring(false)}
        title="Transferir Demanda para Administração"
        size="full"
      >
        <form onSubmit={handleTransferToAdmin} className="flex flex-col h-full bg-neutral-50/50 -m-6 text-left">
          <div className="bg-white px-8 py-6 border-b border-neutral-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-[2rem] bg-red-50 text-red-600 shadow-sm ring-1 ring-black/5">
                  <ArrowRightLeft className="h-8 w-8" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-neutral-900 uppercase tracking-tight">Devolver Demanda</h2>
                  <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mt-1">Sua responsabilidade será encerrada</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsTransferring(false)}
                  className="rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-widest text-neutral-500 hover:bg-neutral-100 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 rounded-xl bg-red-600 px-6 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-red-600/20 hover:bg-red-700 transition-all font-black"
                >
                  {isSubmitting ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  {isSubmitting ? 'Processando...' : 'Confirmar Transferência'}
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-12">
            <div className="max-w-4xl mx-auto space-y-8">
              <div className="rounded-3xl bg-amber-50 p-6 shadow-sm border border-amber-100 flex items-start gap-4">
                <div className="p-2 rounded-xl bg-white shadow-sm text-amber-600">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-amber-900">Atenção ao Devolver</h4>
                  <p className="text-xs text-amber-800 leading-relaxed mt-1">
                    Ao transferir esta demanda, ela deixará de estar sob sua responsabilidade e será devolvida para a equipe administrativa interna. 
                    Certifique-se de anexar qualquer progresso ou documento relevante.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-neutral-200">
                  <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-6">Motivo da Transferência *</p>
                  <textarea
                    required
                    value={transferReason}
                    onChange={(e) => setTransferReason(e.target.value)}
                    placeholder="Explique detalhadamente por que está devolvendo esta demanda..."
                    rows={8}
                    className="w-full rounded-3xl bg-neutral-50 border-transparent px-5 py-4 text-sm font-medium text-neutral-900 focus:bg-white focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition-all outline-none ring-1 ring-neutral-200 resize-none"
                  />
                </div>

                <div className="space-y-8">
                  <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-neutral-200">
                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-6">Anexos Complementares (Máx 5)</p>
                    
                    {arquivosTransferencia.length > 0 && (
                      <div className="mb-4 space-y-2">
                        {arquivosTransferencia.map((f, i) => (
                          <div key={i} className="flex items-center gap-3 bg-emerald-50 rounded-2xl px-4 py-3 border border-emerald-100 animate-in fade-in slide-in-from-top-2">
                            <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                            <span className="text-xs font-bold text-emerald-700 truncate flex-1">{f.name}</span>
                            <button 
                              type="button" 
                              onClick={() => setArquivosTransferencia(prev => prev.filter((_, idx) => idx !== i))}
                              className="h-6 w-6 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-500 hover:bg-emerald-200 transition-all"
                            >
                              <XCircle className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {arquivosTransferencia.length < 5 && (
                      <label
                        htmlFor="transfer-file-p"
                        className="flex flex-col items-center justify-center w-full h-[150px] cursor-pointer rounded-3xl border-2 border-dashed bg-neutral-50 border-neutral-200 hover:bg-neutral-100 hover:border-indigo-300 text-neutral-400 transition-all"
                      >
                        <input
                          type="file"
                          id="transfer-file-p"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            setArquivosTransferencia(prev => [...prev, ...files].slice(0, 5));
                          }}
                        />
                        <div className="flex flex-col items-center text-center p-6">
                          <div className="p-4 rounded-full mb-4 bg-white/50">
                            <Upload className="h-8 w-8" />
                          </div>
                          <p className="text-sm font-black">Anexar Documentos</p>
                          <p className="text-[10px] uppercase font-black opacity-60 mt-1">{arquivosTransferencia.length}/5 selecionados</p>
                        </div>
                      </label>
                    )}
                  </div>

                  <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-neutral-200">
                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-4">Informações da Demanda</p>
                    <div className="space-y-2">
                       <p className="text-xs font-bold text-neutral-600">ID: <span className="text-neutral-400 font-mono">#{selectedDemanda?.id.slice(0, 8)}</span></p>
                       <p className="text-xs font-bold text-neutral-600">Serviço: <span className="text-neutral-900">{selectedDemanda?.titulo || selectedDemanda?.ordem_servico?.orcamento?.servico?.nome}</span></p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </Modal>
    </div>

      {/* Modal de Confirmação de Recusa */}
      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() => { setConfirmModal({ isOpen: false, demanda: null }); setRecusaMotivo(''); }}
        title="Recusar Demanda"
        size="wide"
      >
        <div className="space-y-5">
          <div className="rounded-2xl bg-red-50 p-5 border border-red-100 flex items-start gap-4">
            <XCircle className="h-6 w-6 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-900">Tem certeza que deseja recusar esta demanda?</p>
              <p className="text-xs text-red-700 mt-1 leading-relaxed">
                A demanda será devolvida ao pool central da administração e o motivo será registrado no histórico.
              </p>
            </div>
          </div>

          {confirmModal.demanda && (
            <div className="rounded-xl bg-neutral-50 p-4 border border-neutral-100">
              <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Demanda</p>
              <p className="text-sm font-bold text-neutral-900">{confirmModal.demanda.titulo || confirmModal.demanda.ordem_servico?.orcamento?.servico?.nome || `#${confirmModal.demanda.id?.slice(0, 8)}`}</p>
              <p className="text-xs text-neutral-500 mt-1">Valor proposto: <span className="font-bold text-neutral-700">{formatCurrency(confirmModal.demanda.valor_proposto_admin || 0)}</span></p>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-black uppercase text-neutral-400 tracking-widest mb-2">Motivo da Recusa *</label>
            <textarea
              value={recusaMotivo}
              onChange={(e) => setRecusaMotivo(e.target.value)}
              placeholder="Ex: Fora da minha área de atuação, valor insuficiente para cobrir custos..."
              rows={4}
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-medium text-neutral-900 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-400/20 transition-all resize-none"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { setConfirmModal({ isOpen: false, demanda: null }); setRecusaMotivo(''); }}
              className="flex-1 rounded-xl border border-neutral-200 py-3 text-sm font-bold text-neutral-600 hover:bg-neutral-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isSubmitting || !recusaMotivo.trim()}
              onClick={confirmReject}
              className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-black text-white shadow-lg shadow-red-600/20 hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Recusando...</>
              ) : (
                <><XCircle className="h-4 w-4" />Confirmar Recusa</>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
