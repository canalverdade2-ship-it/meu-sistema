import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { Orcamento } from '../../types';
import { formatCurrency, formatDate, generateCode, handleError } from '../../lib/utils';
import { FileText, Clock, CheckCircle, XCircle, MessageSquare, Percent, Info, Plus, Search, ChevronRight, ChevronLeft, Upload, Trash2, ShoppingBag, Briefcase as BriefcaseIcon, CalendarCheck } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { toast } from 'react-hot-toast';
import { notificationService } from '../../lib/notificationService';
import { osService } from '../../lib/osService';
import { useClientNotifications } from '../../hooks/useClientNotifications';
import { validarCPF } from '../../utils/cpfValidator';
import { logService } from '../../lib/logService';
import { useAutoFitTabs } from '../../hooks/useAutoFitTabs';
import { clientOperationalWrite } from '../../lib/clientOperationalWrite';
import { callClientRpc } from '../../lib/clientRpc';

type PendingServiceRequest = {
  title?: string;
  description?: string;
};

interface DadosPessoais {
  nome: string;
  cpf: string;
  telefone: string;
  email: string;
}

interface DadosEmprestimo {
  valor: number;
  prazo: string;
  motivo: string;
}

interface DocFiles {
  identidade: File | null;
  comprovanteRenda: File | null;
  comprovanteResidencia: File | null;
}

export function ClientOrcamentos({ 
  clientId, 
  initialTab, 
  initialItemId,
  onNavigate
}: { 
  clientId: string, 
  initialTab?: string, 
  initialItemId?: string,
  onNavigate?: (module: string, tab?: string) => void
}) {
  const { containerRef: orcamentosTabsRef, setButtonRef: setOrcamentosTabButtonRef } = useAutoFitTabs(16, 10);
  const { pendencies } = useClientNotifications();
  const [activeTab, setActiveTab] = useState<'abertos' | 'aprovados'>(
    initialTab === 'aprovados' ? initialTab : 'abertos'
  );
  const [monthFilter, setMonthFilter] = useState<string>('');
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [selectedOrcamento, setSelectedOrcamento] = useState<Orcamento | null>(null);
  const [isNegotiateModalOpen, setIsNegotiateModalOpen] = useState(false);
  const [isRequestDiscountOpen, setIsRequestDiscountOpen] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [prefillRequest, setPrefillRequest] = useState<PendingServiceRequest | null>(null);
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
  const [selectedTrackingOrcamento, setSelectedTrackingOrcamento] = useState<Orcamento | null>(null);
  const [isDuvidaModalOpen, setIsDuvidaModalOpen] = useState(false);
  const [duvidaMessage, setDuvidaMessage] = useState('');
  
  const [isAvaliacaoModalOpen, setIsAvaliacaoModalOpen] = useState(false);
  const [isTrocaModalOpen, setIsTrocaModalOpen] = useState(false);
  const [avaliacaoData, setAvaliacaoData] = useState({ nota: 5, comentario: '' });
  const [trocaData, setTrocaData] = useState({ tipo: 'troca', motivo: '' });
  const [hasAvaliado, setHasAvaliado] = useState(false);
  const [hasTrocaRequisitada, setHasTrocaRequisitada] = useState(false);

  const [pendencyFiles, setPendencyFiles] = useState<Record<string, Record<string, File>>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingDuvida, setIsSubmittingDuvida] = useState(false);
  const [isSubmittingAcao, setIsSubmittingAcao] = useState(false);
  const hasAutoOpened = useRef<string | null>(null);

  useEffect(() => {
    if (initialTab === 'solicitar') {
      try {
        const rawRequest = localStorage.getItem('gsa_pending_service_request');
        if (rawRequest) {
          const parsed = JSON.parse(rawRequest);
          setPrefillRequest({
            title: parsed?.title || '',
            description: parsed?.description || ''
          });
          localStorage.removeItem('gsa_pending_service_request');
        }
      } catch (error) {
        console.warn('Nao foi possivel carregar a solicitacao pendente:', error);
      }
      setActiveTab('abertos');
      setIsRequestModalOpen(true);
      return;
    }

    if (initialTab === 'abertos' || initialTab === 'aprovados') {
      setActiveTab(initialTab);
    }
  }, [initialTab]);


  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);

  useEffect(() => {
    if (initialItemId && orcamentos.length > 0 && !isLoading && hasAutoOpened.current !== initialItemId) {
      const item = orcamentos.find(o => o.id === initialItemId);
      
      if (item) {
        hasAutoOpened.current = initialItemId;
        setSelectedOrcamento(item);
        if (item.status === 'aberto' || item.status === 'pendente' || item.status === 'negociação' || item.status === 'em revisão' || item.status === 'pendência documentos') {
          setActiveTab('abertos');
        } else if (item.status === 'aprovado' || item.status === 'produção' || item.status === 'em separação') {
          setActiveTab('aprovados');
        }
        
        if ((item.status === 'aberto' && (item.desconto || 0) <= 0) || item.status === 'negociação') {
          setIsNegotiateModalOpen(true);
        }
        
        // Scroll to the item
        setTimeout(() => {
          const element = document.getElementById(`budget-${initialItemId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHighlightedItemId(item.id);
            setTimeout(() => setHighlightedItemId(null), 3000);
          }
        }, 500);
      } else {
        if (initialTab && initialTab !== activeTab) {
          setActiveTab(initialTab);
        }
      }
    }
  }, [initialItemId, orcamentos, initialTab, isLoading, activeTab]);
  const [negotiationData, setNegotiationData] = useState({
    motivo: '',
    porcentagem: 0
  });
  const [comprovanteFiles, setComprovanteFiles] = useState<File[]>([]);
  const [isConfirmingNegotiation, setIsConfirmingNegotiation] = useState(false);
  const activeTabRef = useRef(activeTab);
  const selectedOrcamentoRef = useRef(selectedOrcamento);

  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
  useEffect(() => { selectedOrcamentoRef.current = selectedOrcamento; }, [selectedOrcamento]);

  useEffect(() => {
    if (isTrackingModalOpen && selectedTrackingOrcamento) {
      const checkStatus = async () => {
        if (selectedTrackingOrcamento.produto_id) {
          const { data: av } = await supabase.from('loja_avaliacoes')
            .select('id').eq('produto_id', selectedTrackingOrcamento.produto_id).eq('cliente_id', clientId).limit(1);
          setHasAvaliado(!!(av && av.length > 0));
        }

        const { data: tr } = await supabase.from('loja_solicitacoes')
          .select('id').eq('orcamento_origem_id', selectedTrackingOrcamento.id).limit(1);
        setHasTrocaRequisitada(!!(tr && tr.length > 0));
      };
      checkStatus();
    }
  }, [isTrackingModalOpen, selectedTrackingOrcamento, clientId]);

  useEffect(() => {
    fetchOrcamentos();
  }, [activeTab, clientId, monthFilter]);

  const fetchOrcamentosRef = useRef<() => void>(() => {});
  useEffect(() => {
    fetchOrcamentosRef.current = fetchOrcamentos;
  });

  // Stable Realtime Subscription
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const debouncedFetch = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        fetchOrcamentosRef.current();
      }, 300);
    };

    const channel = supabase
      .channel(`client-orc-rt-${clientId}-${Date.now()}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orcamentos',
        filter: `cliente_id=eq.${clientId}`
      }, (payload) => {
        debouncedFetch();
        if (payload.new && selectedOrcamentoRef.current && (payload.new as any).id === selectedOrcamentoRef.current.id) {
          const updatedOrc = payload.new as any;
          // Se o status mudou externamente, fechamos o modal e avisamos o usuário
          if (updatedOrc.status !== selectedOrcamentoRef.current?.status) {
            toast(`O orçamento ${updatedOrc.codigo_orcamento} foi atualizado para "${updatedOrc.status}".`);
            setIsNegotiateModalOpen(false);
            setIsRequestDiscountOpen(false);
            setSelectedOrcamento(null);
          } else {
            setSelectedOrcamento(prev => prev ? { ...prev, ...payload.new } as any : null);
          }
        }
      })
      .subscribe();

    return () => {
      clearTimeout(timeoutId);
      supabase.removeChannel(channel);
    };
  }, [clientId]); // Dependency only on clientId

  const fetchOrcamentos = async () => {
    setIsLoading(true);

    try {
      let query = supabase
        .from('orcamentos')
        .select('*, clientes(nome), servicos(nome), produtos(nome), assinaturas(nome), promocoes(titulo, codigo_promocao, descricao)')
        .eq('cliente_id', clientId)
        .in('categoria', ['servico'])
        .or('origem_gsa_store.eq.false,origem_gsa_store.is.null');
      
      if (activeTab === 'abertos') {
        query = query.in('status', ['aberto', 'pendente', 'negociação', 'em revisão', 'pendência documentos']);
      } else {
        query = query.in('status', ['aprovado', 'cancelado']);
      }

      const { data, error } = await query.order('data_criacao', { ascending: false });
      
      if (error) {
        console.error('Error fetching orcamentos:', error);
      } else if (data) {
        let filtered = data as any[];
        if (monthFilter) {
          filtered = filtered.filter(orc => orc.data_criacao.startsWith(monthFilter));
        }
        setOrcamentos(filtered);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePendencyFileChange = (orcId: string, docName: string, file: File) => {
    setPendencyFiles(prev => ({
      ...prev,
      [orcId]: {
        ...(prev[orcId] || {}),
        [docName]: file
      }
    }));
  };

  const handleSubmitPendency = async (orc: Orcamento) => {
    const filesToUpload = pendencyFiles[orc.id];
    if (!filesToUpload || Object.keys(filesToUpload).length === 0) {
      toast.error('Selecione pelo menos um documento.');
      return;
    }

    setIsSubmitting(true);
    try {
      const uploadedUrls: any[] = [...(orc.anexos || [])];

      for (const [docName, file] of Object.entries(filesToUpload)) {
        const fileExt = (file as any).name.split('.').pop();
        const fileName = `${docName.replace(/\s+/g, '_')}-${Date.now()}.${fileExt}`;
        const filePath = `solicitacoes/${clientId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('documentos_cliente')
          .upload(filePath, file as any);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('documentos_cliente')
          .getPublicUrl(filePath);
        
        uploadedUrls.push({ nome: docName, url: publicUrl });
      }

      await clientOperationalWrite(clientId, 'orcamentos', 'update', {
        status: 'em revisão',
        anexos: uploadedUrls,
        documentos_solicitados: []
      }, { id: orc.id });

      await notificationService.notifyAdmin(
        'Pendência de Documentos Resolvida',
        `O cliente enviou os documentos solicitados do orçamento ${orc.codigo_orcamento}. O orçamento retornou para análise.`,
        'vendas',
        'orcamento_negociacao',
        { itemId: orc.id, tab: 'abertos', prioridade: 'alta' }
      );

      toast.success('Documentos enviados com sucesso!');
      fetchOrcamentos();
      setPendencyFiles(prev => {
        const newState = { ...prev };
        delete newState[orc.id];
        return newState;
      });
    } catch (err: any) {
      toast.error(handleError(err, 'Erro ao enviar documentos'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async (orc: Orcamento) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const result = await callClientRpc<any>('gsa_client_approve_budget', {
        p_orcamento_id: orc.id,
      });
      toast.success(result?.already_approved ? 'Orçamento já estava aprovado.' : 'Orçamento aprovado com sucesso!');

      await logService.logAction({
        ator_tipo: 'cliente',
        ator_id: clientId,
        acao: 'APROVAR_ORCAMENTO',
        detalhes: `Aprovou o orçamento #${orc.codigo_orcamento}`
      });

      if (onNavigate) {
        if (result?.tipo === 'servico') onNavigate('servicos', 'andamento');
        else if (result?.tipo === 'produto') onNavigate('produtos', 'comprados');
        else if (result?.tipo === 'assinatura') onNavigate('assinaturas', 'ativas');
        else onNavigate('servicos_assinaturas', 'orcamentos');
      } else {
        setActiveTab('aprovados');
        fetchOrcamentos();
      }
    } catch (err: any) {
      console.error('Erro ao aprovar orçamento:', err);
      toast.error(handleError(err, 'Erro ao aprovar orçamento'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartNegotiation = async () => {
    if (!selectedOrcamento || isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      // Verificar se o status ainda permite negociação
      const { data: currentOrc, error: fetchError } = await supabase
        .from('orcamentos')
        .select('status')
        .eq('id', selectedOrcamento.id)
        .single();

      if (fetchError || (currentOrc?.status !== 'aberto' && currentOrc?.status !== 'negociação')) {
        toast.error('Este orçamento já foi alterado por outro usuário.');
        setIsNegotiateModalOpen(false);
        setIsSubmitting(false);
        fetchOrcamentos();
        return;
      }

      const comprovante_concorrente_urls: string[] = [];
      if (comprovanteFiles.length > 0) {
        for (const file of comprovanteFiles) {
          const fileExt = file.name.split('.').pop();
          const fileName = `concorrente-${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
          const filePath = `solicitacoes/${clientId}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('orcamentos')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('orcamentos')
            .getPublicUrl(filePath);
          
          comprovante_concorrente_urls.push(publicUrl);
        }
      }

      await clientOperationalWrite(clientId, 'orcamentos', 'update', {
        status: 'negociação',
        desconto_solicitado_porcentagem: negotiationData.porcentagem,
        motivo_desconto: negotiationData.motivo,
        fase_negociacao: 'admin',
        comprovante_concorrente_urls
      }, { id: selectedOrcamento.id });

      // Notify Admin
      await notificationService.notifyAdmin(
        '🤝 Proposta de Negociação',
        `O cliente ativou negociação no orçamento ${selectedOrcamento.codigo_orcamento} pedindo ${negotiationData.porcentagem}% de desconto.`,
        'vendas',
        'orcamento_negociacao',
        { itemId: selectedOrcamento.id, tab: 'abertos', prioridade: 'alta' }
      );

      toast.success('Solicitação de negociação enviada!');
      
      await logService.logAction({
        ator_tipo: 'cliente',
        ator_id: clientId,
        acao: 'NEGOCIAR_ORCAMENTO',
        detalhes: `Solicitou negociação no orçamento #${selectedOrcamento.codigo_orcamento} (${negotiationData.porcentagem}%)`
      });

      setIsNegotiateModalOpen(false);
      setIsRequestDiscountOpen(false);
      setIsConfirmingNegotiation(false);
      setNegotiationData({ motivo: '', porcentagem: 0 });
      setComprovanteFiles([]);
      setActiveTab('abertos');
      fetchOrcamentos();
    } catch (err) {
      toast.error('Erro ao enviar solicitação.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveAdminProposal = async (orc: Orcamento) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const result = await callClientRpc<any>('gsa_client_approve_budget', {
        p_orcamento_id: orc.id,
      });

      toast.success(result?.already_approved ? 'Proposta ja estava aprovada.' : 'Proposta aprovada!');

      if (onNavigate) {
        if (result?.tipo === 'servico') onNavigate('servicos', 'andamento');
        else if (result?.tipo === 'produto') onNavigate('produtos', 'comprados');
        else if (result?.tipo === 'assinatura') onNavigate('assinaturas', 'ativas');
        else onNavigate('servicos_assinaturas', 'orcamentos');
      } else {
        setActiveTab('aprovados');
        fetchOrcamentos();
      }
    } catch (err: any) {
      console.error('Erro ao aprovar proposta:', err);
      toast.error(handleError(err, 'Erro ao aprovar proposta'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelNegotiation = async (orc: Orcamento) => {
    try {
      // Verificar se o status permite cancelamento
      const { data: currentOrc, error: fetchError } = await supabase
        .from('orcamentos')
        .select('status')
        .eq('id', orc.id)
        .single();

      if (fetchError || (currentOrc?.status !== 'aberto' && currentOrc?.status !== 'negociação' && currentOrc?.status !== 'em revisão')) {
        toast.error('Este orçamento já foi alterado e não pode mais ser cancelado.');
        setIsNegotiateModalOpen(false);
        fetchOrcamentos();
        return;
      }

      await clientOperationalWrite(clientId, 'orcamentos', 'update', { status: 'cancelado' }, { id: orc.id });

      // Sincronizar cancelamento com a tabela de empréstimos
      if (orc.categoria === 'emprestimo') {
        await clientOperationalWrite(clientId, 'emprestimos', 'update', { status: 'cancelado' }, { orcamento_id: orc.id });
      }

      // Notify Admin
      await notificationService.notifyAdmin(
        'Orçamento Cancelado pelo Cliente',
        `O cliente ${(orc as any).clientes?.nome || 'Cliente'} cancelou o orçamento ${orc.codigo_orcamento}.`,
        'vendas',
        'orcamento_cancelado',
        { itemId: orc.id, tab: 'aprovados', prioridade: 'alta' }
      );

      toast.success('Orçamento cancelado.');

      await logService.logAction({
        ator_tipo: 'cliente',
        ator_id: clientId,
        acao: 'CANCELAR_ORCAMENTO',
        detalhes: `Cancelou o orçamento #${orc.codigo_orcamento}`
      });

      setActiveTab('aprovados');
      fetchOrcamentos();
    } catch (err) {
      toast.error('Erro ao cancelar orçamento.');
    }
  };

  const handleSubmitDuvida = async () => {
    if (!selectedTrackingOrcamento || !duvidaMessage.trim() || isSubmittingDuvida) return;
    setIsSubmittingDuvida(true);

    try {
      const { data: cliente } = await supabase.from('clientes').select('nome').eq('id', clientId).single();
      const assunto = `Dúvida sobre Pedido #${selectedTrackingOrcamento.codigo_orcamento}`;

      const ticket = await clientOperationalWrite<{ id: string }>(clientId, 'tickets', 'insert', {
        assunto,
        descricao: duvidaMessage,
        status: 'aberto'
      });

      await notificationService.notifyAdmin(
        '🎟️ Novo Ticket (Loja)',
        `${cliente?.nome || clientId} tem dúvida no pedido #${selectedTrackingOrcamento.codigo_orcamento}`,
        'suporte',
        'ticket_aberto_cliente',
        { itemId: ticket.id, tab: 'abertos' }
      );

      toast.success('Dúvida enviada! Acompanhe a resposta pelo módulo Suporte.');
      setIsDuvidaModalOpen(false);
      setDuvidaMessage('');
    } catch (err) {
      toast.error(handleError(err, 'enviar dúvida'));
    } finally {
      setIsSubmittingDuvida(false);
    }
  };

  const handleSubmitAvaliacao = async () => {
    if (!selectedTrackingOrcamento || !selectedTrackingOrcamento.produto_id || isSubmittingAcao) return;
    setIsSubmittingAcao(true);
    try {
      await clientOperationalWrite(clientId, 'loja_avaliacoes', 'insert', {
        produto_id: selectedTrackingOrcamento.produto_id,
        nota: avaliacaoData.nota,
        comentario: avaliacaoData.comentario
      });
      toast.success('Avaliação enviada com sucesso! Obrigado pelo seu feedback.');
      setHasAvaliado(true);
      setIsAvaliacaoModalOpen(false);
    } catch (error) {
      toast.error(handleError(error, 'enviar avaliação'));
    } finally {
      setIsSubmittingAcao(false);
    }
  };

  const handleSubmitTroca = async () => {
    if (!selectedTrackingOrcamento || !trocaData.motivo.trim() || isSubmittingAcao) return;
    setIsSubmittingAcao(true);
    try {
      // Verificar se já existe uma solicitação para este pedido
      const { data: existing } = await supabase
        .from('loja_solicitacoes')
        .select('id')
        .eq('orcamento_origem_id', selectedTrackingOrcamento.id)
        .limit(1);

      if (existing && existing.length > 0) {
        toast.error('Este pedido já possui uma solicitação de troca ou devolução ativa.');
        setIsSubmittingAcao(false);
        return;
      }

      const { data: cliente } = await supabase.from('clientes').select('nome').eq('id', clientId).single();
      
      await clientOperationalWrite(clientId, 'loja_solicitacoes', 'insert', {
        codigo_solicitacao: generateCode('TRC'),
        orcamento_origem_id: selectedTrackingOrcamento.id,
        tipo: trocaData.tipo,
        motivo: trocaData.motivo,
        status: 'em_analise'
      });

      await notificationService.notifyAdmin(
        '🔄 Nova Solicitação de Troca/Devolução',
        `O cliente ${cliente?.nome || clientId} solicitou ${trocaData.tipo} para o pedido #${selectedTrackingOrcamento.codigo_orcamento}`,
        'vendas',
        'orcamento_negociacao',
        { itemId: selectedTrackingOrcamento.id, tab: 'aprovados' }
      );

      toast.success('Solicitação enviada! Nossa equipe analisará seu pedido em breve.');
      setHasTrocaRequisitada(true);
      setIsTrocaModalOpen(false);
    } catch (error) {
      toast.error(handleError(error, 'enviar solicitação'));
    } finally {
      setIsSubmittingAcao(false);
    }
  };

  const calculatePreview = () => {
    if (!selectedOrcamento) return 0;
    return selectedOrcamento.total * (1 - negotiationData.porcentagem / 100);
  };

  const meses = [
    { value: '-01-', label: 'Janeiro' },
    { value: '-02-', label: 'Fevereiro' },
    { value: '-03-', label: 'Março' },
    { value: '-04-', label: 'Abril' },
    { value: '-05-', label: 'Maio' },
    { value: '-06-', label: 'Junho' },
    { value: '-07-', label: 'Julho' },
    { value: '-08-', label: 'Agosto' },
    { value: '-09-', label: 'Setembro' },
    { value: '-10-', label: 'Outubro' },
    { value: '-11-', label: 'Novembro' },
    { value: '-12-', label: 'Dezembro' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6">
        {/* Row 2: Filter and Button (Moved Above Tabs) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <button 
            onClick={() => setIsRequestModalOpen(true)}
            className="flex items-center justify-center gap-2 rounded-2xl bg-[#1a1a1a] px-8 py-3.5 text-[11px] font-black uppercase tracking-[0.15em] text-white shadow-xl shadow-black/20 transition-all hover:bg-black active:scale-95 group sm:w-auto w-full"
          >
            <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
            Solicitar Orçamento
          </button>

          <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-2xl ring-1 ring-neutral-200 shadow-sm w-full sm:w-auto">
            <CalendarCheck className="h-4 w-4 text-indigo-500" />
            <select 
              value={monthFilter ? `-${monthFilter.split('-')[1]}-` : ''} 
              onChange={e => {
                const val = e.target.value;
                if (!val) setMonthFilter('');
                else {
                  const year = new Date().getFullYear();
                  setMonthFilter(`${year}${val}`);
                }
              }} 
              className="bg-transparent text-[11px] sm:text-xs font-black uppercase tracking-widest text-neutral-600 focus:outline-none cursor-pointer w-full"
            >
              <option value="">Todos os Meses</option>
              {meses.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 1: Tabs */}
        <div className="flex items-center justify-start">
          <div ref={orcamentosTabsRef} className="flex w-full sm:w-auto gap-1 rounded-3xl bg-neutral-200/50 p-1 ring-1 ring-neutral-300 shadow-inner overflow-hidden">
            {['abertos', 'aprovados'].map((t, index) => {
              let badge = 0;
              if (t === 'abertos') badge = pendencies.orcamentos_abertos;
              
              return (
                <button 
                  key={t}
                  ref={setOrcamentosTabButtonRef(index)}
                  onClick={() => setActiveTab(t as any)}
                  className={`flex min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-2xl px-1.5 py-2.5 font-black capitalize leading-none transition-all sm:gap-2 sm:px-8 ${activeTab === t ? 'bg-white text-indigo-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}`}
                >
                  <span className="min-w-0 whitespace-nowrap">{t}</span>
                  {badge > 0 && (
                    <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[8px] font-black text-white ring-1 ring-white/20 animate-pulse">
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {orcamentos.map((orc) => (
          <div id={`budget-${orc.id}`} key={orc.id} className={`group relative overflow-hidden rounded-2xl bg-white p-4 sm:p-5 transition-all duration-500 ${highlightedItemId === orc.id ? 'ring-4 ring-indigo-500 shadow-2xl shadow-indigo-500/20 scale-[1.02] z-10' : 'shadow-sm hover:shadow-md ring-1 ring-neutral-200/60'}`}>
            {highlightedItemId === orc.id && (
              <span className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500 ring-4 ring-white animate-pulse z-20 flex items-center justify-center">
                <span className="h-2 w-2 rounded-full bg-white" />
              </span>
            )}
            
            <div className="flex items-start justify-between pb-3 border-b border-neutral-100">
               <div className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg shadow-inner ${
                    orc.status === 'aberto' ? 'bg-amber-100/50 text-amber-600 ring-1 ring-amber-200/50' : 
                    orc.status === 'negociação' ? 'bg-indigo-100/50 text-indigo-600 ring-1 ring-indigo-200/50' :
                    orc.status === 'pendência documentos' ? 'bg-rose-100/50 text-rose-600 ring-1 ring-rose-200/50' :
                    orc.status === 'aprovado' ? 'bg-emerald-100/50 text-emerald-600 ring-1 ring-emerald-200/50' : 'bg-red-100/50 text-red-600 ring-1 ring-red-200/50'
                  }`}>
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block mb-0.5">Orçamento Nº</span>
                    <span className="font-mono text-xs sm:text-sm font-black text-neutral-800 leading-none">{orc.codigo_orcamento}</span>
                  </div>
               </div>
               <div className="text-right">
                  <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block mb-0.5">Data de Solicitação</span>
                  <span className="font-mono text-xs sm:text-sm font-black text-neutral-800 leading-none">{formatDate(orc.data_criacao)}</span>
               </div>
            </div>

            <h3 className={`mt-4 text-sm sm:text-lg font-black text-neutral-900 leading-tight transition-all ${orc.status === 'em revisão' ? 'text-center px-4' : 'text-left'}`}>
              {orc.titulo_solicitacao || (orc.categoria === 'servico' 
                ? (orc as any).servicos?.nome 
                : orc.categoria === 'produto'
                ? (orc as any).produtos?.nome
                : (orc as any).assinaturas?.nome) || 'Solicitação de Orçamento'}
              {orc.categoria && <span className="inline-flex items-center justify-center h-5 px-2 ml-2 bg-neutral-100 text-neutral-500 text-[10px] font-black rounded-md rounded-tl-none ring-1 ring-neutral-200/50">x{orc.quantidade || 1}</span>}
            </h3>

            {orc.nivel_prioridade && (
              <div className={`mt-2 ${orc.status === 'em revisão' ? 'text-center' : ''}`}>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                  orc.nivel_prioridade === 'alta' 
                    ? 'bg-red-100 text-red-700 ring-1 ring-red-200' 
                    : orc.nivel_prioridade === 'media'
                    ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-200'
                    : 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200'
                }`}>
                  {orc.nivel_prioridade === 'alta' ? '🔴 Alta' 
                   : orc.nivel_prioridade === 'media' ? '🟡 Média' 
                   : '🟢 Baixa'}
                </span>
              </div>
            )}
            
            <div className={`mt-3 space-y-3 ${(orc.status === 'em revisão' || orc.status === 'pendência documentos') ? 'hidden' : ''}`}>
              <div>
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-0.5">Observações</p>
                <p className="text-xs text-neutral-600 leading-relaxed">{orc.descricao_solicitacao || orc.observacoes_servico || 'Sem observações.'}</p>
              </div>

              <div className="space-y-1.5 rounded-xl bg-neutral-50 p-3 ring-1 ring-neutral-200">
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-neutral-500">
                    {orc.categoria === 'servico' ? 'Valor do Serviço' : orc.categoria === 'produto' ? 'Valor do Produto' : 'Valor da Assinatura'}
                  </span>
                  <span className="font-bold text-neutral-900">
                    {formatCurrency(orc.categoria === 'servico' ? orc.valor_servico : orc.categoria === 'produto' ? (orc.valor_produto || orc.valor_servico) : (orc.valor_assinatura || orc.valor_servico))}
                  </span>
                </div>

                {orc.categoria === 'assinatura' && (
                  <div className="flex justify-between text-[10px] -mt-1.5 pb-1">
                    <span className="text-neutral-400 uppercase font-black tracking-widest">Duração Contratada</span>
                    <span className="font-black text-indigo-600 uppercase">
                      {orc.quantidade_meses ? `${orc.quantidade_meses} Meses` : 'Prazo Indeterminado'}
                    </span>
                  </div>
                )}
                
                {orc.quantidade && orc.quantidade > 1 && (
                  <div className="flex justify-between text-sm border-t border-neutral-100 pt-2">
                    <span className="text-neutral-500">Subtotal ({orc.quantidade}x)</span>
                    <span className="font-bold text-neutral-900">
                      {formatCurrency((orc.categoria === 'servico' ? orc.valor_servico : orc.categoria === 'produto' ? (orc.valor_produto || orc.valor_servico) : (orc.valor_assinatura || orc.valor_servico)) * orc.quantidade)}
                    </span>
                  </div>
                )}
                
                {orc.valor_adicional > 0 && (
                  <div className="space-y-1 border-t border-neutral-100 pt-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-500">Valor Adicional</span>
                      <span className="font-bold text-neutral-900">{formatCurrency(orc.valor_adicional)}</span>
                    </div>
                    {orc.descricao_adicional && (
                      <p className="text-[10px] text-neutral-400 italic leading-tight bg-white/50 p-1.5 rounded-lg">
                        <span className="font-bold uppercase mr-1">Detalhes:</span>
                        {orc.descricao_adicional}
                      </p>
                    )}
                  </div>
                )}

                {orc.acrescimo > 0 && (
                  <div className="space-y-1 border-t border-neutral-100 pt-2">
                    <div className="flex justify-between text-sm text-amber-600">
                      <span className="font-bold">
                        {orc.categoria === 'loja' ? 'Juros do Crédito GSA' : 'Acréscimo'}
                      </span>
                      <span className="font-bold">+ {formatCurrency(orc.acrescimo)}</span>
                    </div>
                    {orc.categoria === 'loja' && orc.descricao_adicional && (
                      <p className="text-[10px] text-neutral-400 italic leading-tight bg-white/50 p-1.5 rounded-lg">
                        <span className="font-bold uppercase mr-1">Taxa:</span>
                        {orc.descricao_adicional}
                      </p>
                    )}
                  </div>
                )}

                {orc.desconto > 0 && !(orc as any).promocoes && (
                  <div className="flex justify-between text-sm text-emerald-600 border-t border-neutral-100 pt-2">
                    <span className="font-bold">Desconto</span>
                    <span className="font-bold">- {formatCurrency(orc.desconto)}</span>
                  </div>
                )}
                
                {(orc as any).promocoes && (
                  <div className="mt-3 bg-indigo-50/40 p-3 rounded-xl border border-indigo-100/60">
                    <p className="text-[11px] font-bold text-indigo-900 mb-2 uppercase tracking-wider">Detalhes da Promoção</p>
                    <div className="space-y-1.5 text-[10px]">
                      <div className="flex justify-between">
                        <span className="text-indigo-700/70">Promoção Aplicada:</span>
                        <span className="font-medium text-indigo-900">{(orc as any).promocoes.titulo}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-indigo-700/70">Código da Promoção:</span>
                        <span className="font-medium text-indigo-900">{(orc as any).promocoes.codigo_promocao}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-indigo-700/70">Desconto da Promoção:</span>
                        <span className="font-bold text-emerald-600">-{formatCurrency(orc.desconto)}</span>
                      </div>
                      {(orc as any).promocoes.descricao && (
                        <div className="pt-1">
                          <span className="text-indigo-700/70 block mb-0.5">Descrição da Promoção:</span>
                          <span className="font-medium text-indigo-900 block bg-white/60 p-1.5 rounded border border-indigo-100/50 leading-relaxed">{(orc as any).promocoes.descricao}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3">
              {orc.status !== 'em revisão' && (
                <div>
                  <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Total do Orçamento</p>
                  <p className="text-lg font-black text-indigo-600">{formatCurrency(orc.total)}</p>
                </div>
              )}
            </div>

            {orc.status === 'aberto' && (
              <div className="mt-4 flex gap-2 flex-wrap">
                <button 
                  onClick={() => handleApprove(orc)}
                  className="flex-1 min-w-[100px] rounded-lg bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700"
                >
                  Aprovar
                </button>
                {orc.desconto <= 0 && (
                  <button 
                    onClick={() => { setSelectedOrcamento(orc); setIsNegotiateModalOpen(true); }}
                    className="flex-1 min-w-[100px] rounded-lg bg-indigo-600 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-700"
                  >
                    Negociar
                  </button>
                )}
                <button 
                  onClick={() => handleCancelNegotiation(orc)}
                  className="flex-1 min-w-[100px] rounded-lg bg-red-50 py-2.5 text-xs font-bold text-red-600 hover:bg-red-100 border border-red-100"
                >
                  Cancelar
                </button>
              </div>
            )}

            {orc.status === 'negociação' && (
              <div className="mt-4 space-y-3">
                <div className="rounded-xl bg-indigo-50 p-3 ring-1 ring-indigo-100">
                  <p className="text-[10px] sm:text-xs font-bold text-indigo-700 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {orc.fase_negociacao === 'admin' ? 'Aguardando análise administrativa' : 'Proposta recebida do administrativo'}
                  </p>
                  {orc.fase_negociacao === 'cliente' && orc.proposta_admin_porcentagem && (
                    <div className="mt-3">
                      <p className="text-sm text-indigo-900">O administrativo propôs um desconto de <strong>{orc.proposta_admin_porcentagem}%</strong>.</p>
                      <p className="text-lg font-black text-indigo-600 mt-1">{formatCurrency(orc.total * (1 - orc.proposta_admin_porcentagem / 100))}</p>
                    </div>
                  )}
                </div>
                
                {orc.fase_negociacao === 'cliente' && (
                  <div className="flex gap-3">
                    <button 
                      onClick={() => handleApproveAdminProposal(orc)}
                      className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700"
                    >
                      Aprovar Proposta
                    </button>
                    <button 
                      onClick={() => handleCancelNegotiation(orc)}
                      className="flex-1 rounded-xl bg-red-50 py-3 text-sm font-bold text-red-600 hover:bg-red-100"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            )}

            {orc.status === 'em revisão' && (
              <div className="mt-6">
                <div className="rounded-2xl bg-amber-50 p-6 ring-1 ring-amber-100 mb-4">
                  <p className="text-sm font-black text-amber-900 flex items-center gap-2 mb-2">
                    <Clock className="h-5 w-5" />
                    Orçamento em Análise
                  </p>
                  <p className="text-xs font-medium text-amber-700 leading-relaxed">
                    A Solicitação de Orçamento foi gerada com sucesso sob nº <span className="font-black">#{orc.codigo_orcamento}</span> e está em análise, aguarde o prazo de até 24 horas para o envio da proposta completa.
                  </p>
                </div>
                <button 
                  onClick={() => handleCancelNegotiation(orc)}
                  className="w-full rounded-xl bg-red-50 py-3 text-sm font-bold text-red-600 hover:bg-red-100"
                >
                  Cancelar Solicitação
                </button>
              </div>
            )}

            {orc.status === 'pendência documentos' && (
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl bg-rose-50 p-6 ring-1 ring-rose-100">
                  <p className="text-sm font-black text-rose-900 flex items-center gap-2 mb-2">
                    <Info className="h-5 w-5" />
                    Pendência de Documentos
                  </p>
                  <p className="text-xs font-medium text-rose-700 leading-relaxed mb-4">
                    O administrador solicitou os seguintes documentos para prosseguir com seu orçamento:
                  </p>
                  <div className="space-y-3">
                    {((orc as any).documentos_solicitados || []).map((doc: string, idx: number) => (
                      <div key={idx} className="flex flex-col gap-2">
                        <label className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm ring-1 ring-neutral-200 cursor-pointer hover:ring-indigo-500 transition-all">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className="h-8 w-8 flex-shrink-0 bg-neutral-50 rounded-lg flex items-center justify-center text-neutral-400">
                              {pendencyFiles[orc.id]?.[doc] ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <Upload className="h-4 w-4" />}
                            </div>
                            <p className="text-xs font-bold text-neutral-900 truncate">{doc}</p>
                          </div>
                          <input 
                            type="file" 
                            className="hidden" 
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handlePendencyFileChange(orc.id, doc, file);
                            }}
                          />
                          {pendencyFiles[orc.id]?.[doc] && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg font-black uppercase">Pronto</span>
                          )}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => handleCancelNegotiation(orc)}
                    className="rounded-xl border border-neutral-200 py-3 text-sm font-bold text-neutral-400 hover:bg-neutral-50"
                  >
                    Desistir
                  </button>
                  <button 
                    onClick={() => handleSubmitPendency(orc)}
                    disabled={isSubmitting || !pendencyFiles[orc.id] || Object.keys(pendencyFiles[orc.id]).length < ((orc as any).documentos_solicitados || []).length}
                    className="rounded-xl bg-indigo-600 py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Enviando...' : 'Enviar Documentos'}
                  </button>
                </div>
              </div>
            )}

            {orc.status === 'aprovado' && (
              <div className="mt-6">
                {orc.origem_gsa_store && orc.categoria === 'produto' ? (
                  <button 
                    onClick={() => { setSelectedTrackingOrcamento(orc); setIsTrackingModalOpen(true); }}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#1a1a1a] py-3 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-black/20 hover:bg-black hover:scale-[1.02] transition-all"
                  >
                    <ShoppingBag className="h-4 w-4" />
                    Acompanhar Pedido
                  </button>
                ) : (
                  <div className="rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
                    <p className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                      <CheckCircle className="h-4 w-4" />
                      Este orçamento foi aprovado e gerou uma Ordem de Serviço.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {orcamentos.length === 0 && (
          <div className="col-span-full py-24 text-center">
            <p className="text-neutral-400 font-medium">Nenhum orçamento encontrado nesta categoria.</p>
          </div>
        )}
      </div>

      {/* Negotiation Modal */}
      <Modal 
        isOpen={isNegotiateModalOpen} 
        onClose={() => {
          setIsNegotiateModalOpen(false);
          setIsRequestDiscountOpen(false);
          setIsConfirmingNegotiation(false);
          setComprovanteFiles([]);
        }} 
        title="Negociar Orçamento"
        size="full"
      >
        {selectedOrcamento && (
          <div className="space-y-6">
            {!isRequestDiscountOpen ? (
              <div className="space-y-6">
                <div className="rounded-2xl bg-neutral-100 p-6 ring-1 ring-neutral-300">
                  <p className="text-xs font-bold text-neutral-400 uppercase">Valor Atual</p>
                  <p className="text-3xl font-black text-neutral-900">{formatCurrency(selectedOrcamento.total)}</p>
                </div>
                {(selectedOrcamento.desconto || 0) <= 0 ? (
                  <button 
                    onClick={() => setIsRequestDiscountOpen(true)}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-4 font-bold text-white shadow-xl shadow-indigo-600/20 hover:bg-indigo-700"
                  >
                    <Percent className="h-5 w-5" />
                    Solicitar Desconto
                  </button>
                ) : (
                  <div className="rounded-2xl bg-emerald-50 p-6 ring-1 ring-emerald-200 flex gap-4">
                    <CheckCircle className="h-6 w-6 text-emerald-600 shrink-0" />
                    <div className="space-y-1">
                      <p className="text-sm text-emerald-900 font-bold">Desconto Aplicado</p>
                      <p className="text-xs text-emerald-800 leading-relaxed">
                        Este orçamento já possui um desconto aplicado e não permite novas solicitações de negociação.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : !isConfirmingNegotiation ? (
              <div className="space-y-6">
                <div>
                  <label className="mb-1 block text-sm font-bold text-neutral-700">Motivo da Solicitação de Desconto *</label>
                  <textarea 
                    rows={3}
                    value={negotiationData.motivo}
                    onChange={e => setNegotiationData({...negotiationData, motivo: e.target.value})}
                    placeholder="Explique por que você deseja um desconto..."
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-bold text-neutral-700">Digite a Porcentagem do Desconto que deseja (%) *</label>
                  <input 
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max="100"
                    value={isNaN(negotiationData.porcentagem) ? 0 : negotiationData.porcentagem}
                    onChange={e => {
                      const val = e.target.value === '' ? 0 : Number(e.target.value);
                      setNegotiationData({...negotiationData, porcentagem: isNaN(val) ? 0 : val});
                    }}
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-lg font-bold focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-bold text-neutral-700">Comprovante do Concorrente (Obrigatório, Máx 5) *</label>
                  <div className="space-y-3">
                    <label className="flex items-center justify-center w-full h-16 border-2 border-dashed border-neutral-300 rounded-xl bg-neutral-50 hover:bg-neutral-100 hover:border-indigo-500 transition-all cursor-pointer overflow-hidden px-4">
                      <div className="flex items-center gap-2 truncate">
                        <Upload className="h-5 w-5 text-neutral-400 shrink-0" />
                        <span className="text-sm font-bold text-neutral-600">
                          {comprovanteFiles.length >= 5 ? 'Limite atingido' : 'Buscar Arquivos'}
                        </span>
                      </div>
                      <input 
                        type="file" 
                        className="hidden" 
                        multiple
                        disabled={comprovanteFiles.length >= 5}
                        onChange={e => {
                          const selected = Array.from(e.target.files || []);
                          if (comprovanteFiles.length + selected.length > 5) {
                            toast.error('Limite de 5 arquivos atingido.');
                            return;
                          }
                          setComprovanteFiles(prev => [...prev, ...selected]);
                        }} 
                        accept=".pdf,.jpg,.jpeg,.png" 
                      />
                    </label>

                    {comprovanteFiles.length > 0 && (
                      <div className="space-y-2">
                        {comprovanteFiles.map((file, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-white rounded-lg border border-neutral-200 shadow-sm animate-in slide-in-from-right-2">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <FileText className="h-4 w-4 text-indigo-500 shrink-0" />
                              <span className="text-xs font-medium text-neutral-700 truncate">{file.name}</span>
                            </div>
                            <button 
                              onClick={() => setComprovanteFiles(prev => prev.filter((_, i) => i !== idx))}
                              className="p-1 text-neutral-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-3xl bg-indigo-50 p-8 ring-1 ring-indigo-100 text-center">
                  <p className="text-xs font-bold text-indigo-400 uppercase mb-2">Prévia do Valor</p>
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-sm text-neutral-400 line-through">{formatCurrency(selectedOrcamento.total)}</p>
                    <p className="text-5xl font-black text-indigo-600">{formatCurrency(calculatePreview())}</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => setIsRequestDiscountOpen(false)}
                    className="flex-1 rounded-2xl border border-neutral-200 py-4 font-bold text-neutral-600 hover:bg-neutral-50"
                  >
                    Voltar
                  </button>
                  <button 
                    disabled={!negotiationData.motivo || negotiationData.porcentagem <= 0 || comprovanteFiles.length === 0}
                    onClick={() => setIsConfirmingNegotiation(true)}
                    className="flex-1 rounded-2xl bg-indigo-600 py-4 font-bold text-white shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Confirmar Solicitação
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="rounded-2xl bg-amber-50 p-6 ring-1 ring-amber-200 flex gap-4">
                  <Info className="h-6 w-6 text-amber-600 shrink-0" />
                  <div className="space-y-2">
                    <p className="text-sm text-amber-900 font-bold">Informativo de Negociação</p>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      O desconto solicitado será analisado e poderá ser aprovado ou recusado pelo nosso setor administrativo.
                    </p>
                    <p className="text-xs font-bold text-amber-900">
                      O prazo é de 48 horas para retorno.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => setIsConfirmingNegotiation(false)}
                    className="flex-1 rounded-2xl border border-neutral-200 py-4 font-bold text-neutral-600 hover:bg-neutral-50"
                  >
                    Voltar
                  </button>
                  <button 
                    onClick={handleStartNegotiation}
                    disabled={isSubmitting}
                    className="flex-1 rounded-2xl bg-indigo-600 py-4 font-bold text-white shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Enviando...' : 'Confirmar e Enviar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal isOpen={isRequestModalOpen} onClose={() => { setIsRequestModalOpen(false); setPrefillRequest(null); }} title="Solicitar Orçamento" size="full">
        <ModalSolicitarOrcamento 
          clientId={clientId} 
          prefill={prefillRequest}
          onFinish={() => {
            setIsRequestModalOpen(false);
            setPrefillRequest(null);
            fetchOrcamentos();
          }} 
          onCancel={() => { setIsRequestModalOpen(false); setPrefillRequest(null); }} 
        />
      </Modal>

      <Modal isOpen={isTrackingModalOpen} onClose={() => { setIsTrackingModalOpen(false); setIsDuvidaModalOpen(false); setIsAvaliacaoModalOpen(false); setIsTrocaModalOpen(false); }} title="Rastreamento do Pedido" size="wide">
        {selectedTrackingOrcamento && (
          <div className="space-y-8">
            <div className="rounded-2xl bg-neutral-100 p-6 ring-1 ring-neutral-300">
              <h3 className="text-xl font-black text-neutral-900 mb-2">{selectedTrackingOrcamento.titulo_solicitacao || (selectedTrackingOrcamento as any).produtos?.nome}</h3>
              <p className="text-sm text-neutral-500 font-medium">Pedido #{selectedTrackingOrcamento.codigo_orcamento}</p>
            </div>

            <div className="relative pl-6 space-y-8 before:absolute before:inset-y-0 before:left-2 before:w-0.5 before:bg-neutral-200">
              {[
                { status: 'pedido_realizado', label: 'Pedido Realizado', icon: ShoppingBag, date: selectedTrackingOrcamento.data_criacao },
                { status: 'pagamento_aprovado', label: 'Pagamento Aprovado', icon: CheckCircle, date: selectedTrackingOrcamento.data_pagamento_aprovado },
                { status: 'separacao', label: 'Em Separação', icon: BriefcaseIcon, date: selectedTrackingOrcamento.data_separacao },
                { status: 'em_transito', label: 'Em Transporte', icon: CheckCircle, date: selectedTrackingOrcamento.data_envio },
                { status: 'entregue', label: 'Entregue', icon: CheckCircle, date: selectedTrackingOrcamento.data_entrega },
              ].map((step, idx, arr) => {
                const currentStatusIdx = arr.findIndex(s => s.status === (selectedTrackingOrcamento.status_entrega || 'pedido_realizado'));
                const isCompleted = idx <= currentStatusIdx;
                const isCurrent = idx === currentStatusIdx;

                return (
                  <div key={step.status} className="relative flex items-start gap-4">
                    <span className={`absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white ${
                      isCurrent ? 'bg-indigo-600 animate-pulse' : isCompleted ? 'bg-indigo-600' : 'bg-neutral-300'
                    }`}>
                      <span className="h-2 w-2 rounded-full bg-white" />
                    </span>
                    <div>
                      <p className={`text-sm font-bold ${isCompleted ? 'text-neutral-900' : 'text-neutral-400'}`}>
                        {step.label}
                      </p>
                      {step.date && (
                        <p className="text-xs text-neutral-500 mt-1">{formatDate(step.date)}</p>
                      )}
                      {step.status === 'em_transito' && isCompleted && selectedTrackingOrcamento.rastreio_codigo && (
                        <div className="mt-3 p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                          <p className="text-[10px] font-black uppercase text-neutral-400">Código de Rastreio ({selectedTrackingOrcamento.rastreio_transportadora || 'Transportadora'})</p>
                          <p className="text-sm font-mono font-bold text-neutral-900 mt-1">{selectedTrackingOrcamento.rastreio_codigo}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedTrackingOrcamento.status_entrega === 'entregue' && (
              <div className="flex gap-4 pt-4 border-t border-neutral-100 flex-col sm:flex-row">
                {!hasAvaliado && (
                  <button 
                    onClick={() => { setIsAvaliacaoModalOpen(true); setIsTrocaModalOpen(false); setIsDuvidaModalOpen(false); }}
                    className="flex-1 rounded-xl bg-amber-50 py-3 text-sm font-bold text-amber-600 ring-1 ring-amber-200 hover:bg-amber-100 transition-colors flex justify-center items-center gap-2"
                  >
                    ⭐ Avaliar Produto
                  </button>
                )}
                {!hasTrocaRequisitada && (
                  <button 
                    onClick={() => { setIsTrocaModalOpen(true); setIsAvaliacaoModalOpen(false); setIsDuvidaModalOpen(false); }}
                    className="flex-1 rounded-xl bg-rose-50 py-3 text-sm font-bold text-rose-600 ring-1 ring-rose-200 hover:bg-rose-100 transition-colors flex justify-center items-center gap-2"
                  >
                    🔄 Troca / Devolução
                  </button>
                )}
              </div>
            )}

            {hasTrocaRequisitada && !isTrocaModalOpen && (
               <div className="rounded-xl bg-rose-50 p-4 ring-1 ring-rose-100 text-sm font-medium text-rose-800 flex items-center gap-2">
                 <CheckCircle className="h-5 w-5 text-rose-600 shrink-0" />
                 Você já possui uma solicitação de troca ou devolução para este pedido. Acompanhe em "Minhas Solicitações" ou aguarde nosso contato.
               </div>
            )}

            {isAvaliacaoModalOpen && !hasAvaliado && (
              <div className="space-y-4 rounded-2xl bg-amber-50 p-6 ring-1 ring-amber-200 animate-in fade-in slide-in-from-bottom-4">
                <h4 className="font-bold text-amber-900 mb-2">Avaliar Produto</h4>
                <div className="flex gap-2 justify-center mb-4">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button 
                      key={star}
                      onClick={() => setAvaliacaoData({ ...avaliacaoData, nota: star })}
                      className={`text-3xl transition-transform hover:scale-110 ${avaliacaoData.nota >= star ? 'text-amber-500' : 'text-neutral-300'}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <textarea 
                  rows={3}
                  value={avaliacaoData.comentario}
                  onChange={e => setAvaliacaoData({ ...avaliacaoData, comentario: e.target.value })}
                  placeholder="Conte-nos o que achou do produto (opcional)..."
                  className="w-full rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm focus:border-amber-500 focus:outline-none"
                />
                <div className="flex gap-3 mt-4">
                  <button 
                    onClick={() => setIsAvaliacaoModalOpen(false)}
                    className="flex-1 rounded-xl bg-white py-3 text-sm font-bold text-amber-700 ring-1 ring-amber-300 hover:bg-amber-100"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleSubmitAvaliacao}
                    disabled={isSubmittingAcao}
                    className="flex-1 rounded-xl bg-amber-500 py-3 text-sm font-bold text-white shadow-lg shadow-amber-500/20 hover:bg-amber-600 disabled:opacity-50"
                  >
                    {isSubmittingAcao ? 'Enviando...' : 'Enviar Avaliação'}
                  </button>
                </div>
              </div>
            )}

            {isTrocaModalOpen && !hasTrocaRequisitada && (
              <div className="space-y-4 rounded-2xl bg-rose-50 p-6 ring-1 ring-rose-200 animate-in fade-in slide-in-from-bottom-4">
                <h4 className="font-bold text-rose-900 mb-2">Solicitação de Troca ou Devolução</h4>
                
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm font-bold text-rose-800 cursor-pointer">
                    <input 
                      type="radio" 
                      checked={trocaData.tipo === 'troca'} 
                      onChange={() => setTrocaData({ ...trocaData, tipo: 'troca' })}
                      className="text-rose-600 focus:ring-rose-500" 
                    />
                    Trocar Produto
                  </label>
                  <label className="flex items-center gap-2 text-sm font-bold text-rose-800 cursor-pointer">
                    <input 
                      type="radio" 
                      checked={trocaData.tipo === 'devolucao'} 
                      onChange={() => setTrocaData({ ...trocaData, tipo: 'devolucao' })}
                      className="text-rose-600 focus:ring-rose-500" 
                    />
                    Devolver Produto
                  </label>
                </div>

                <div className="mt-4">
                  <label className="mb-1 block text-sm font-bold text-rose-900">Motivo da Solicitação *</label>
                  <textarea 
                    rows={4}
                    value={trocaData.motivo}
                    onChange={e => setTrocaData({ ...trocaData, motivo: e.target.value })}
                    placeholder="Explique detalhadamente o motivo da sua solicitação..."
                    className="w-full rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm focus:border-rose-500 focus:outline-none"
                  />
                </div>

                <div className="flex gap-3 mt-4">
                  <button 
                    onClick={() => setIsTrocaModalOpen(false)}
                    className="flex-1 rounded-xl bg-white py-3 text-sm font-bold text-rose-700 ring-1 ring-rose-300 hover:bg-rose-100"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleSubmitTroca}
                    disabled={isSubmittingAcao || !trocaData.motivo.trim()}
                    className="flex-1 rounded-xl bg-rose-600 py-3 text-sm font-bold text-white shadow-lg shadow-rose-600/20 hover:bg-rose-700 disabled:opacity-50"
                  >
                    {isSubmittingAcao ? 'Enviando...' : 'Confirmar Solicitação'}
                  </button>
                </div>
              </div>
            )}

            {!isDuvidaModalOpen && !isAvaliacaoModalOpen && !isTrocaModalOpen ? (
              <button 
                onClick={() => setIsDuvidaModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-neutral-100 py-4 text-sm font-bold text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900 transition-colors"
              >
                <MessageSquare className="h-4 w-4" />
                Dúvidas sobre o pedido?
              </button>
            ) : isDuvidaModalOpen ? (
              <div className="space-y-4 rounded-2xl bg-indigo-50 p-6 ring-1 ring-indigo-100 animate-in fade-in slide-in-from-bottom-4">
                <h4 className="font-bold text-indigo-900 flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Enviar Dúvida
                </h4>
                <textarea 
                  rows={4}
                  value={duvidaMessage}
                  onChange={e => setDuvidaMessage(e.target.value)}
                  placeholder="Escreva sua dúvida e nossa equipe retornará no módulo de Suporte..."
                  className="w-full rounded-xl border border-indigo-200 bg-white px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none"
                />
                <div className="flex gap-3">
                  <button 
                    onClick={() => setIsDuvidaModalOpen(false)}
                    className="flex-1 rounded-xl bg-white py-3 text-sm font-bold text-indigo-600 ring-1 ring-indigo-200 hover:bg-indigo-50"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleSubmitDuvida}
                    disabled={isSubmittingDuvida || !duvidaMessage.trim()}
                    className="flex-1 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isSubmittingDuvida ? 'Enviando...' : 'Enviar Dúvida'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </Modal>
    </div>
  );
}

function ModalSolicitarOrcamento({ clientId, prefill, onFinish, onCancel }: { clientId: string, prefill?: PendingServiceRequest | null, onFinish: () => void, onCancel: () => void }) {
  const [categoriaEscolhida, setCategoriaEscolhida] = useState<'servico' | 'produto' | 'assinatura' | 'emprestimo' | null>(null);
  const [step, setStep] = useState(0); // 0 = seleção categoria
  const [tituloSolicitacao, setTituloSolicitacao] = useState('');
  const [descricaoSolicitacao, setDescricaoSolicitacao] = useState('');
  const [nivelPrioridade, setNivelPrioridade] = useState<'baixa' | 'media' | 'alta'>('baixa');
  const [files, setFiles] = useState<{ file: File, nome: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados de promoção ativa
  const [promocaoDetectada, setPromocaoDetectada] = useState<{ promocao: any, clientePromocao: any } | null>(null);
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
  const [promocaoAplicadaId, setPromocaoAplicadaId] = useState<string | null>(null);
  const [promocaoAplicadaInfo, setPromocaoAplicadaInfo] = useState<any | null>(null);

  useEffect(() => {
    if (!prefill) return;

    setCategoriaEscolhida('servico');
    setStep(1);
    setTituloSolicitacao(prefill.title || '');
    setDescricaoSolicitacao(prefill.description || '');
  }, [prefill]);

  const checkActivePromotion = async (categoria: string) => {
    try {
      const { data: clientPromos } = await supabase
        .from('cliente_promocoes')
        .select('*, promocoes!inner(*)')
        .eq('cliente_id', clientId)
        .eq('status', 'ativa')
        .eq('promocoes.status', 'ativa');

      const { data: openOrcamentos } = await supabase
        .from('orcamentos')
        .select('promocao_id')
        .eq('cliente_id', clientId)
        .neq('status', 'cancelado')
        .not('promocao_id', 'is', null);

      const usedPromoIds = openOrcamentos?.map((o: any) => o.promocao_id) || [];

      const available = (clientPromos || []).filter((cp: any) => {
        const promo = cp.promocoes as any;
        const matchesCategory = promo.tipo === 'geral' || promo.tipo === categoria;
        return matchesCategory && !usedPromoIds.includes(cp.promocao_id);
      });

      if (available.length > 0) {
        setPromocaoDetectada({ promocao: available[0].promocoes, clientePromocao: available[0] });
        setIsPromoModalOpen(true);
      } else {
        setPromocaoDetectada(null);
        setPromocaoAplicadaId(null);
        setPromocaoAplicadaInfo(null);
      }
    } catch (err) {
      console.error('Erro ao verificar promoção ativa no portal do cliente:', err);
    }
  };

  // Estados de empréstimo
  const [dadosPessoais, setDadosPessoais] = useState<DadosPessoais>({ nome_completo: '', data_nascimento: '', rg: '', cpf: '', telefone: '', cep: '', numero_casa: '', endereco_rua: '', endereco_bairro: '', endereco_cidade: '', endereco_uf: '', email: '' });
  const [dadosEmprestimo, setDadosEmprestimo] = useState<DadosEmprestimo>({ valor_desejado: '', parcelas_desejadas: 0, data_desejada: '' });
  const [docFiles, setDocFiles] = useState<DocFiles>({ cnh: null, comprovante_endereco: null, holerite: null, foto_perfil: null });

  const handleFinishEmprestimo = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      // Upload docs
      const uploadedDocs: { tipo: string; nome: string; url: string }[] = [];
      for (const [tipo, file] of Object.entries(docFiles)) {
        if (!file) continue;
        const ext = (file as File).name.split('.').pop();
        const path = `solicitacoes/${clientId}/${tipo}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('emprestimos').upload(path, file as File);
        if (upErr) throw upErr;
        const { data: { publicUrl } } = supabase.storage.from('emprestimos').getPublicUrl(path);
        uploadedDocs.push({ tipo, nome: (file as File).name, url: publicUrl });
      }

      const valorNum = parseFloat(dadosEmprestimo.valor_desejado.replace(/\./g, '').replace(',', '.')) || 0;

      const insertData: any = {
        cliente_id: clientId,
        codigo_orcamento: generateCode('ORC'),
        status: 'em revisão',
        categoria: 'emprestimo',
        data_criacao: new Date().toISOString().split('T')[0],
        titulo_solicitacao: 'Solicitação de Empréstimo',
        descricao_solicitacao: `Empréstimo de R$ ${dadosEmprestimo.valor_desejado} em ${dadosEmprestimo.parcelas_desejadas}x`,
        nivel_prioridade: 'media',
        observacoes_servico: `Empréstimo solicitado pelo cliente`,
        total: valorNum,
        valor_servico: 0,
        quantidade: 1,
        emprestimo_nome_completo: dadosPessoais.nome_completo,
        emprestimo_data_nascimento: dadosPessoais.data_nascimento,
        emprestimo_rg: dadosPessoais.rg,
        emprestimo_cpf: dadosPessoais.cpf.replace(/\D/g, ''),
        emprestimo_telefone: dadosPessoais.telefone,
        emprestimo_cep: dadosPessoais.cep,
        emprestimo_numero_casa: dadosPessoais.numero_casa,
        emprestimo_endereco_rua: dadosPessoais.endereco_rua,
        emprestimo_endereco_bairro: dadosPessoais.endereco_bairro,
        emprestimo_endereco_cidade: dadosPessoais.endereco_cidade,
        emprestimo_endereco_uf: dadosPessoais.endereco_uf,
        emprestimo_email: dadosPessoais.email,
        emprestimo_valor_desejado: valorNum,
        emprestimo_parcelas_desejadas: dadosEmprestimo.parcelas_desejadas,
        emprestimo_data_desejada: dadosEmprestimo.data_desejada,
        anexos: uploadedDocs,
      };

      const newBudget = await clientOperationalWrite<{ id: string }>(clientId, 'orcamentos', 'insert', insertData);

      // Criar registro imediato na tabela de gestão de empréstimos para o ADM
      const newEmp = await clientOperationalWrite<{ id: string }>(clientId, 'emprestimos', 'insert', {
        codigo_emprestimo: generateCode('EMP'),
        orcamento_id: newBudget.id,
        valor_solicitado: valorNum,
        status: 'analise_inicial'
      });

      // Salvar docs na tabela emprestimo_documentos
      for (const doc of uploadedDocs) {
        await clientOperationalWrite(clientId, 'emprestimo_documentos', 'insert', {
          orcamento_id: newBudget.id,
          tipo: doc.tipo,
          nome: doc.nome,
          url: doc.url,
          status: 'enviado'
        });
      }

      // Registrar histórico
      await clientOperationalWrite(clientId, 'emprestimo_historico', 'insert', {
        orcamento_id: newBudget.id,
        tipo_acao: 'solicitacao_criada',
        descricao: `Cliente solicitou empréstimo de R$ ${dadosEmprestimo.valor_desejado} em ${dadosEmprestimo.parcelas_desejadas}x`,
        usuario_tipo: 'cliente',
        usuario_id: clientId
      });

      await notificationService.notifyAdmin(
        '💰 Nova Solicitação de Empréstimo',
        `Um cliente solicitou um empréstimo de R$ ${dadosEmprestimo.valor_desejado}`,
        'emprestimos',
        'emprestimo_criado',
        { itemId: newEmp?.id || newBudget.id, tab: 'solicitacoes', prioridade: 'alta' }
      );

      toast.success('Solicitação de empréstimo enviada com sucesso!');
      onFinish();
    } catch (err: any) {
      toast.error(handleError(err, 'Erro ao enviar solicitação'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (files.length + selectedFiles.length > 5) {
      toast.error('Limite máximo de 5 documentos.');
      return;
    }
    const newFiles = (selectedFiles as File[]).map(f => ({ file: f, nome: f.name.split('.')[0] }));
    setFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleFinish = async () => {
    if (isSubmitting) return;
    if (!tituloSolicitacao.trim()) {
      toast.error('Informe o serviço desejado.');
      return;
    }
    if (!descricaoSolicitacao.trim()) {
      toast.error('Descreva sua solicitação.');
      return;
    }
    setIsSubmitting(true);

    try {
      const uploadedAnexos: { nome: string, url: string }[] = [];

      // Upload files first
      for (const { file, nome } of files) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
        const filePath = `solicitacoes/${clientId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('documentos_cliente')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('documentos_cliente')
          .getPublicUrl(filePath);
        
        uploadedAnexos.push({ nome: nome || file.name, url: publicUrl });
      }

      // Calcular desconto da promoção, se aplicada
      let descontoPromocao = 0;
      let obsPromocao = descricaoSolicitacao.trim();
      if (promocaoAplicadaId && promocaoAplicadaInfo) {
        if (promocaoAplicadaInfo.tipo_desconto === 'valor') {
          descontoPromocao = promocaoAplicadaInfo.valor_desconto || 0;
        }
        // Para porcentagem, o admin aplica quando define o valor final.
        // Mas registramos a promoção associada.
        obsPromocao = `Promoção aplicada: ${promocaoAplicadaInfo.titulo} (${promocaoAplicadaInfo.codigo_promocao}).\n${obsPromocao}`.trim();
      }

      const insertData: any = {
        cliente_id: clientId,
        codigo_orcamento: generateCode('ORC'),
        status: 'em revisão',
        categoria: categoriaEscolhida || 'servico',
        data_criacao: new Date().toISOString().split('T')[0],
        titulo_solicitacao: tituloSolicitacao.trim(),
        descricao_solicitacao: descricaoSolicitacao.trim(),
        nivel_prioridade: nivelPrioridade,
        observacoes_servico: obsPromocao,
        anexos: uploadedAnexos,
        total: 0,
        valor_servico: 0,
        quantidade: 1,
        ...(promocaoAplicadaId ? { promocao_id: promocaoAplicadaId, desconto: descontoPromocao } : {})
      };

      const newBudget = await clientOperationalWrite<{ id: string }>(clientId, 'orcamentos', 'insert', insertData);

      // Se houve promoção aplicada, notificar admin com destaque especial
      const tituloNotif = promocaoAplicadaId
        ? `🏷️ Orçamento com Promoção Ativa — ${nivelPrioridade === 'alta' ? '🔴 ALTA' : nivelPrioridade === 'media' ? '🟡 Média' : '🟢 Baixa'}`
        : nivelPrioridade === 'alta'
        ? '🔴 Solicitação de Orçamento — Prioridade ALTA'
        : nivelPrioridade === 'media'
        ? '🟡 Solicitação de Orçamento — Prioridade Média'
        : '📋 Nova Solicitação de Orçamento';

      const msgNotif = promocaoAplicadaId
        ? `Um cliente solicitou orçamento de "${tituloSolicitacao}" e possui a promoção ativa "${promocaoAplicadaInfo?.titulo} (${promocaoAplicadaInfo?.codigo_promocao})" — Prioridade: ${nivelPrioridade === 'baixa' ? 'Baixa' : nivelPrioridade === 'media' ? 'Média' : 'Alta'}`
        : `Um cliente enviou uma solicitação: "${tituloSolicitacao}" — Prioridade: ${nivelPrioridade === 'baixa' ? 'Baixa' : nivelPrioridade === 'media' ? 'Média' : 'Alta'}`;

      await notificationService.notifyAdmin(
        tituloNotif,
        msgNotif,
        'vendas',
        'orcamento_criado',
        { itemId: newBudget.id, tab: 'abertos', prioridade: (nivelPrioridade === 'alta' || promocaoAplicadaId) ? 'alta' : 'normal' }
      );

      toast.success('Sua solicitação de orçamento foi enviada com sucesso!');
      onFinish();
    } catch (err: any) {
      toast.error(handleError(err, 'Erro ao enviar solicitação'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalSteps = 3;
  const displayStep = step; // starts from 1 after category selection


  return (
    <div className="space-y-8">

      {/* Modal: Promoção Ativa Detectada */}
      {isPromoModalOpen && promocaoDetectada && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md mx-4 rounded-3xl bg-white p-8 shadow-2xl ring-1 ring-indigo-200">
            <h3 className="text-lg font-black text-neutral-900 uppercase tracking-widest mb-1">🏷️ Promoção Ativa Encontrada!</h3>
            <p className="text-sm text-neutral-500 mb-5">Você possui uma promoção ativa para esta categoria:</p>
            <div className="rounded-2xl bg-indigo-50 border border-indigo-100 p-4 mb-6">
              <p className="font-black text-indigo-900">{promocaoDetectada.promocao.titulo}</p>
              <p className="text-sm text-indigo-700 mt-1">{promocaoDetectada.promocao.descricao}</p>
              <p className="text-xs font-bold text-indigo-500 mt-2">Código: {promocaoDetectada.promocao.codigo_promocao}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setPromocaoAplicadaId(null);
                  setPromocaoAplicadaInfo(null);
                  setIsPromoModalOpen(false);
                }}
                className="flex-1 rounded-xl border border-neutral-200 py-3 text-sm font-bold text-neutral-600 hover:bg-neutral-50 transition-all"
              >
                Não utilizar
              </button>
              <button
                onClick={() => {
                  setPromocaoAplicadaId(promocaoDetectada.promocao.id);
                  setPromocaoAplicadaInfo(promocaoDetectada.promocao);
                  setIsPromoModalOpen(false);
                  toast.success(`Promoção "${promocaoDetectada.promocao.codigo_promocao}" aplicada ao orçamento!`);
                }}
                className="flex-1 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all"
              >
                Utilizar promoção
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Badge de promoção aplicada (feedback visual) */}
      {promocaoAplicadaId && promocaoAplicadaInfo && step > 0 && (
        <div className="flex items-center gap-3 rounded-2xl bg-indigo-50 border border-indigo-100 px-4 py-3">
          <span className="text-lg">🏷️</span>
          <div className="flex-1">
            <p className="text-xs font-black text-indigo-900 uppercase tracking-widest">Promoção Aplicada</p>
            <p className="text-[11px] text-indigo-700">{promocaoAplicadaInfo.titulo} · <span className="font-mono">{promocaoAplicadaInfo.codigo_promocao}</span></p>
          </div>
          <button
            onClick={() => { setPromocaoAplicadaId(null); setPromocaoAplicadaInfo(null); }}
            className="text-indigo-400 hover:text-red-500 transition-colors text-xs font-black"
          >
            Remover
          </button>
        </div>
      )}

      {/* Step 0: Seleção de Categoria */}
      {step === 0 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="text-center space-y-1">
            <h3 className="text-xl font-black text-neutral-900 uppercase tracking-tight">Escolha a Categoria</h3>
            <p className="text-xs text-neutral-500 font-medium tracking-wide">Selecione o tipo de orçamento que deseja solicitar</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { id: 'servico' as const, label: 'Serviço', icon: BriefcaseIcon, desc: 'Contabilidade, consultoria...', color: 'indigo' },
            ].map(cat => (
              <button
                key={cat.id}
                onClick={async () => {
                  setCategoriaEscolhida(cat.id);
                  await checkActivePromotion(cat.id);
                  setStep(1);
                }}
                className={`relative flex flex-col items-center gap-3 rounded-2xl p-6 ring-1 ring-neutral-200 bg-white hover:shadow-lg hover:ring-${cat.color}-400 transition-all group active:scale-95`}
              >
                <div className={`p-4 rounded-xl bg-${cat.color}-50 group-hover:bg-${cat.color}-100 transition-colors`}>
                  <cat.icon className={`h-7 w-7 text-${cat.color}-600`} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-black text-neutral-900 uppercase">{cat.label}</p>
                  <p className="text-[10px] text-neutral-400 mt-1">{cat.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stepper (steps 1+) */}
      {step > 0 && (
        <>
          <div className="flex items-center justify-between max-w-md mx-auto">
            {Array.from({ length: totalSteps }, (_, i) => i + 1).map(s => (
              <div key={s} className="flex items-center gap-2">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${step >= s ? 'bg-indigo-600 text-white shadow-lg ring-4 ring-indigo-50' : 'bg-neutral-100 text-neutral-400'}`}>
                  {s}
                </div>
                {s < totalSteps && <div className={`h-1 w-8 sm:w-20 rounded-full transition-all ${step > s ? 'bg-indigo-600' : 'bg-neutral-100'}`} />}
              </div>
            ))}
          </div>

      <div className="min-h-[400px]">
        {/* ===== FLUXO PADRÃO (serviço/produto/assinatura) ===== */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="text-center space-y-1">
              <h3 className="text-xl font-black text-neutral-900 uppercase tracking-tight">Conte-nos o que você precisa</h3>
              <p className="text-xs text-neutral-500 font-medium tracking-wide">Forneça os detalhes para podermos criar o melhor orçamento</p>
            </div>
            
            <div className="space-y-5 bg-white p-5 rounded-2xl ring-1 ring-neutral-200">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-700 uppercase tracking-widest pl-1">Serviço Desejado</label>
                <input 
                  type="text" 
                  value={tituloSolicitacao}
                  onChange={e => setTituloSolicitacao(e.target.value)}
                  placeholder="Ex: Declaração de Imposto de Renda, Abertura de Empresa..."
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-700 uppercase tracking-widest pl-1">Descrição da Solicitação</label>
                <textarea 
                  value={descricaoSolicitacao}
                  onChange={e => setDescricaoSolicitacao(e.target.value)}
                  placeholder="Descreva com detalhes o que você precisa..."
                  rows={4}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none resize-y"
                />
              </div>

              <div className="space-y-3 pt-2 border-t border-neutral-100">
                <label className="text-xs font-bold text-neutral-700 uppercase tracking-widest pl-1 block">Nível de Prioridade</label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {[
                    { id: 'baixa', label: 'Baixa', desc: 'Prazo padrão', color: 'bg-emerald-50 text-emerald-700 ring-emerald-200', active: 'ring-emerald-500 bg-emerald-50' },
                    { id: 'media', label: 'Média', desc: 'Atenção em breve', color: 'bg-amber-50 text-amber-700 ring-amber-200', active: 'ring-amber-500 bg-amber-50' },
                    { id: 'alta', label: 'Alta', desc: 'Urgente / Rápido', color: 'bg-red-50 text-red-700 ring-red-200', active: 'ring-red-500 bg-red-50' }
                  ].map(p => (
                    <button 
                      key={p.id}
                      onClick={() => setNivelPrioridade(p.id as any)}
                      className={`relative flex flex-col items-center gap-1.5 rounded-xl p-3 transition-all ${
                        nivelPrioridade === p.id 
                          ? `shadow-sm ring-2 ${p.active}` 
                          : 'bg-white ring-1 ring-neutral-200 hover:bg-neutral-50'
                      }`}
                    >
                      <span className={`text-xs font-black uppercase tracking-widest ${nivelPrioridade === p.id ? 'text-neutral-900' : 'text-neutral-500'}`}>{p.label}</span>
                      <span className="text-[10px] text-neutral-400 text-center leading-tight">{p.desc}</span>
                      {nivelPrioridade === p.id && (
                        <div className="absolute -top-1.5 -right-1.5 bg-white rounded-full text-indigo-600 shadow-sm ring-1 ring-neutral-200 p-0.5">
                          <CheckCircle className="h-3 w-3" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-neutral-900 uppercase tracking-tight">Anexar Documentos</h3>
              <p className="text-xs text-neutral-500 font-medium">Você pode enviar até 5 arquivos para auxiliar no orçamento</p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2">
              <div className="space-y-4">
                <label className="flex flex-row sm:flex-col items-center justify-center w-full h-28 sm:h-48 border-2 border-dashed border-neutral-300 rounded-2xl bg-neutral-50 hover:bg-neutral-100 hover:border-indigo-500 transition-all cursor-pointer group px-4">
                  <div className="flex flex-row sm:flex-col items-center justify-center gap-4 sm:gap-0 sm:pt-5 sm:pb-6 w-full sm:w-auto">
                    <div className="p-3.5 sm:p-4 bg-white rounded-xl shadow-sm sm:mb-4 group-hover:scale-110 transition-transform">
                      <Upload className="h-5 w-5 sm:h-6 sm:w-6 text-neutral-400 group-hover:text-indigo-600" />
                    </div>
                    <div className="flex flex-col items-start sm:items-center text-left sm:text-center">
                      <span className="text-xs sm:text-sm font-bold text-neutral-600 uppercase tracking-tight sm:mb-0.5">Buscar Arquivos</span>
                      <span className="text-[9px] sm:text-[10px] text-neutral-400 uppercase font-black tracking-widest mt-0.5 sm:mt-0">(Máx 5 arquivos)</span>
                    </div>
                  </div>
                  <input type="file" className="hidden" multiple onChange={handleFileUpload} disabled={files.length >= 5} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.zip" />
                </label>
              </div>

              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-neutral-400 uppercase tracking-widest pl-1">Arquivos Selecionados ({files.length}/5)</h4>
                {files.length > 0 ? (
                  <div className="space-y-2 max-h-[300px] sm:max-h-[160px] overflow-y-auto pr-1">
                    {files.map((item, i) => (
                      <div key={i} className="flex items-center justify-between gap-1.5 rounded bg-white p-1 shadow-sm ring-1 ring-neutral-200 hover:ring-indigo-300 transition-all animate-in slide-in-from-right-3">
                        <div className="flex items-center gap-1.5 overflow-hidden">
                           <FileText className="h-3 w-3 text-indigo-500 flex-shrink-0" />
                           <span className="text-[10px] font-bold text-neutral-500 truncate" title={item.file.name}>{item.file.name}</span>
                        </div>
                        <button onClick={() => removeFile(i)} className="flex-shrink-0 p-1 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-sm transition-colors" title="Remover">
                           <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-28 sm:h-48 rounded-2xl bg-neutral-50 flex items-center justify-center border border-neutral-100 border-dashed">
                     <p className="text-[10px] font-black text-neutral-300 uppercase tracking-widest">Nenhum Anexo</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
             <div className="text-center space-y-1">
              <h3 className="text-xl font-black text-neutral-900 uppercase tracking-tight">Confirmar Solicitação</h3>
              <p className="text-xs text-neutral-500 font-medium tracking-wide">Revise os dados antes de enviar</p>
            </div>

            <div className="bg-white rounded-2xl p-6 ring-1 ring-neutral-200 space-y-4">
               <div>
                 <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Serviço</p>
                 <p className="text-sm font-bold text-neutral-800">{tituloSolicitacao}</p>
               </div>
               
               <div>
                 <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Descrição</p>
                 <p className="text-xs text-neutral-600 bg-neutral-50 p-3 rounded-xl border border-neutral-100">{descricaoSolicitacao}</p>
               </div>

               <div className="flex items-center justify-between border-t border-neutral-100 pt-4">
                  <div>
                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Prioridade</p>
                    <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${
                      nivelPrioridade === 'alta' ? 'bg-red-100 text-red-700' : 
                      nivelPrioridade === 'media' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {nivelPrioridade === 'alta' ? '🔴 Alta' : nivelPrioridade === 'media' ? '🟡 Média' : '🟢 Baixa'}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Anexos</p>
                    <p className="text-xs font-bold text-neutral-700">{files.length} arquivo(s)</p>
                  </div>
               </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-4 border-t border-neutral-100 pt-6">
        {step > 1 && (
          <button 
            onClick={() => setStep(step - 1)}
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-xl border border-neutral-200 px-6 py-3 font-bold text-neutral-600 hover:bg-neutral-50 transition-all active:scale-95 disabled:opacity-50"
          >
            <ChevronLeft className="h-5 w-5" />
            Voltar
          </button>
        )}
        <div className="flex-1" />
        {step < totalSteps ? (
          <button 
            onClick={() => {
              if (step === 1) {
                if (!tituloSolicitacao.trim()) { toast.error('Informe o serviço desejado.'); return; }
                if (!descricaoSolicitacao.trim()) { toast.error('Descreva sua solicitação.'); return; }
              }
              setStep(step + 1)
            }}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-8 py-3 font-black uppercase text-[10px] tracking-widest text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
          >
            Próxima Etapa
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button 
            onClick={handleFinish}
            disabled={isSubmitting}
            className="flex items-center gap-3 rounded-xl bg-[#1a1a1a] px-10 py-3 font-black uppercase text-[10px] tracking-widest text-white shadow-xl transition-all hover:bg-black active:scale-95 disabled:opacity-50 shadow-black/20"
          >
            {isSubmitting ? (
              <>
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                Confirmar Solicitação
                <CheckCircle className="h-4 w-4" />
              </>
            )}
          </button>
        )}
      </div>
      </>
      )}
    </div>
  );
}


