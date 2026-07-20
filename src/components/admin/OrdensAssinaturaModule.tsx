import { useState, useEffect, useRef } from 'react';
import { Search, MoreHorizontal, Calendar, CheckCircle, XCircle, Layers, ShieldCheck, AlertTriangle, Receipt, DollarSign, Info } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Modal } from '../ui/Modal';
import { formatCurrency, formatDate, generateCode, handleError } from '../../lib/utils';
import { GlobalFilter } from '../ui/GlobalFilter';
import { toast } from 'react-hot-toast';
import { createNotification } from '../../lib/notifications';
import { notificationService } from '../../lib/notificationService';
import { logService } from '../../lib/logService';
import { AdminWhatsAppButton } from './ui/AdminWhatsAppButton';
import { whatsappNotificationService } from '../../lib/whatsappNotificationService';

export function OrdensAssinaturaModule({ activeSubTab, initialItemId, colaboradorNome }: { activeSubTab?: 'processamento' | 'concluido' | 'cancelado', initialItemId?: string, colaboradorNome?: string }) {
  const [activeTab, setActiveTab] = useState<'processamento' | 'concluido' | 'cancelado'>('processamento');

  useEffect(() => {
    if (activeSubTab) setActiveTab(activeSubTab);
  }, [activeSubTab]);
  const [ordens, setOrdens] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, any>>({
    mes: '',
    ano: ''
  });
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedOrdem, setSelectedOrdem] = useState<any | null>(null);
  const [isProrrogarModalOpen, setIsProrrogarModalOpen] = useState(false);
  const [isCancelarModalOpen, setIsCancelarModalOpen] = useState(false);
  const [mesesProrrogacao, setMesesProrrogacao] = useState<number>(1);
  const [dataCancelamento, setDataCancelamento] = useState<string>('');
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const hasAutoOpened = useRef<string | null>(null);

  useEffect(() => {
    if (initialItemId && ordens.length > 0 && hasAutoOpened.current !== initialItemId) {
      const timer = setTimeout(() => {
        const element = document.getElementById(`oa-${initialItemId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setHighlightedId(initialItemId);
          
          // Abrir modal automaticamente
          const ordem = ordens.find(o => o.id === initialItemId);
          if (ordem) {
            setSelectedOrdem(ordem);
            setIsDetailOpen(true);
            hasAutoOpened.current = initialItemId;
          }

          setTimeout(() => setHighlightedId(null), 3000);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [initialItemId, ordens]);

  useEffect(() => {
    fetchOrdens();

    const channel = supabase
      .channel('admin-ordens-assinatura-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'ordens_assinatura'
      }, () => {
        fetchOrdens();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTab, search, filters]);

  const fetchOrdens = async () => {
    let selectStr = '*, assinaturas(nome, valor), clientes(nome), faturas(*), orcamentos(*)';
    if (search) {
      selectStr = '*, assinaturas!inner(nome, valor), clientes(nome), faturas(*), orcamentos(*)';
    }

    let query = supabase
      .from('ordens_assinatura')
      .select(selectStr);

    if (activeTab === 'processamento') {
      query = query.in('status', ['em_analise', 'pendente', 'pago']);
    } else if (activeTab === 'concluido') {
      query = query.in('status', ['concluido', 'em_cancelamento']);
    } else {
      query = query.eq('status', 'cancelado');
    }
    
    if (search) {
      query = query.ilike('assinaturas.nome', `%${search}%`);
    }

    if (filters.mes) {
      const year = filters.ano || new Date().getFullYear();
      const startDate = `${year}-${filters.mes}-01`;
      const endDate = new Date(Number(year), Number(filters.mes), 0).toISOString().split('T')[0];
      query = query.gte('data_criacao', startDate).lte('data_criacao', endDate);
    }

    const { data, error } = await query.order('data_criacao', { ascending: false });
    if (error) {
      console.error('Error fetching ordens_assinatura:', error);
      toast.error('Erro ao carregar ordens de assinatura.');
    }
    if (data) {
      setOrdens(data);
    }
  };

  const handleUpdateStatus = async (id: string, status: 'concluido' | 'cancelado', motivo?: string) => {
    const { error } = await supabase
      .from('ordens_assinatura')
      .update({ 
        status, 
        motivo_cancelamento: motivo ? `${motivo}${colaboradorNome ? ` [POR: ${colaboradorNome}]` : ''}` : (colaboradorNome ? `[POR: ${colaboradorNome}]` : null), 
        data_conclusao: status === 'concluido' ? new Date().toISOString() : null,
        data_cancelamento: status === 'cancelado' ? new Date().toISOString() : null
      })
      .eq('id', id);

    if (error) {
      toast.error('Erro ao atualizar status.');
    } else {
      toast.success('Status atualizado com sucesso.');
      
      const ordem = ordens.find(o => o.id === id);
      if (ordem) {
        await notificationService.notifyClient(
          ordem.cliente_id,
          status === 'concluido' ? '✅ Assinatura Concluída' : '❌ Assinatura Cancelada',
          `Sua ordem de assinatura para ${ordem.assinaturas.nome} foi ${status === 'concluido' ? 'concluída com sucesso! 🎉' : 'cancelada pelo administrador. ⚠️'}`,
          'assinaturas',
          status === 'concluido' ? 'assinatura_criada' : 'assinatura_cancelada',
          { tab: status === 'concluido' ? 'ativas' : 'canceladas', itemId: ordem.id, prioridade: 'alta', contexto: { assinatura_id: ordem.id, nome: ordem.assinaturas?.nome } }
        );
      }

      setIsDetailOpen(false);
      
      // Log Action
      await logService.logAction({ acao: 'ACAO_SISTEMA', detalhes: JSON.stringify({}), ator_tipo: 'admin', ator_nome: 'Administrador' });

      fetchOrdens();
    }
  };

  const handleProrrogarAssinatura = async () => {
    if (!selectedOrdem) return;
    try {
      // 1. Atualizar meses da assinatura
      const { error: updateError } = await supabase
        .from('ordens_assinatura')
        .update({
          prazo_meses: (selectedOrdem.prazo_meses || 0) + mesesProrrogacao,
          observacoes_admin: `${selectedOrdem.observacoes_admin || ''} [Prorrogado ${mesesProrrogacao} meses em ${formatDate(new Date())}${colaboradorNome ? ` POR: ${colaboradorNome}` : ''}]`.trim()
        })
        .eq('id', selectedOrdem.id);

      if (updateError) throw updateError;

      // 2. Gerar faturas futuras
      const faturas = [];
      const baseDate = new Date();
      
      for (let i = 1; i <= mesesProrrogacao; i++) {
        const vencimento = new Date(baseDate);
        vencimento.setMonth(baseDate.getMonth() + i);
        
        faturas.push({
          codigo_fatura: generateCode('FAT'),
          ordem_assinatura_id: selectedOrdem.id,
          cliente_id: selectedOrdem.cliente_id,
          valor_total: Number(selectedOrdem.assinaturas.valor) || 0,
          valor_final_pendente: Number(selectedOrdem.assinaturas.valor) || 0,
          status: 'pendente',
          tipo: 'assinatura',
          data_vencimento: vencimento.toISOString().split('T')[0]
        });
      }

      const { error: faturasError } = await supabase
        .from('faturas')
        .insert(faturas);

      if (faturasError) throw faturasError;

      await notificationService.notifyClient(
        selectedOrdem.cliente_id,
        '⏳ Assinatura Prorrogada',
        `Sua assinatura de ${selectedOrdem.assinaturas.nome} foi prorrogada por mais ${mesesProrrogacao} meses. 📅`,
        'assinaturas',
        'assinatura_prorrogada',
        { tab: 'processamento', itemId: selectedOrdem.id, contexto: { assinatura_id: selectedOrdem.id, prorrogacao: mesesProrrogacao } }
      );

      toast.success('Assinatura prorrogada e faturas geradas com sucesso!');
      setIsProrrogarModalOpen(false);
      setIsDetailOpen(false);
      
      // Log Action
      await logService.logAction({ acao: 'ACAO_SISTEMA', detalhes: JSON.stringify({}), ator_tipo: 'admin', ator_nome: 'Administrador' });

      fetchOrdens();
    } catch (error) {
      toast.error(handleError(error, 'prorrogar assinatura'));
    }
  };

  const handleCancelarAssinatura = async () => {
    if (!selectedOrdem || !dataCancelamento) return;
    
    const cancelDate = new Date(dataCancelamento);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (cancelDate < today) {
      toast.error('A data de cancelamento não pode ser retroativa.');
      return;
    }

    try {
      const diffTime = cancelDate.getTime() - today.getTime();
      const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24))); 
      
      let valorProporcional = Number(selectedOrdem.assinaturas.valor) || 0;
      if (diffDays < 30) {
        valorProporcional = ((Number(selectedOrdem.assinaturas.valor) || 0) / 30) * diffDays;
      }

      const isFuture = cancelDate > today;
      const newStatus = isFuture ? 'em_cancelamento' : 'cancelado';

      const { error } = await supabase
        .from('ordens_assinatura')
        .update({
          status: newStatus,
          data_cancelamento: dataCancelamento,
          valor_proporcional_cancelamento: valorProporcional,
          motivo_cancelamento: `Cancelamento agendado via painel${colaboradorNome ? ` [POR: ${colaboradorNome}]` : ''}`
        })
        .eq('id', selectedOrdem.id);

      if (error) throw error;

      await notificationService.notifyClient(
        selectedOrdem.cliente_id,
        isFuture ? '📅 Cancelamento de Assinatura Agendado' : '❌ Assinatura Cancelada',
        isFuture 
          ? `O cancelamento da sua assinatura de ${selectedOrdem.assinaturas.nome} foi agendado para ${formatDate(dataCancelamento)}. ⏳`
          : `Sua assinatura de ${selectedOrdem.assinaturas.nome} foi cancelada. ⚠️`,
        'assinaturas',
        'assinatura_cancelada',
        { tab: isFuture ? 'em_cancelamento' : 'canceladas', itemId: selectedOrdem.id, prioridade: 'alta', contexto: { assinatura_id: selectedOrdem.id, data_cancelamento: dataCancelamento } }
      );

      toast.success(isFuture ? 'Cancelamento agendado com sucesso!' : 'Assinatura cancelada com sucesso!');
      setIsCancelarModalOpen(false);
      setIsDetailOpen(false);
      
      // Log Action
      await logService.logAction({ acao: 'ACAO_SISTEMA', detalhes: JSON.stringify({}), ator_tipo: 'admin', ator_nome: 'Administrador' });

      fetchOrdens();
    } catch (error) {
      toast.error(handleError(error, 'cancelar assinatura'));
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4">
      <div className="grid grid-cols-1 gap-2 rounded-2xl bg-neutral-100 p-1 sm:grid-cols-3">
        {[
          { id: 'processamento' as const, label: 'Processamento' },
          { id: 'concluido' as const, label: 'Ativas' },
          { id: 'cancelado' as const, label: 'Canceladas' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === tab.id
                ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-neutral-200'
                : 'text-neutral-500 hover:bg-white/60 hover:text-neutral-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-end gap-4 px-2 mb-8">
        <GlobalFilter 
          searchValue={search}
          onSearch={setSearch}
          currentFilters={filters}
          onFilterChange={setFilters}
          onClear={() => {
            setSearch('');
            setFilters({ mes: '', ano: new Date().getFullYear().toString() });
          }}
          options={[
            {
              id: 'mes',
              label: 'Mês de Criação',
              type: 'select',
              options: [
                { value: '01', label: 'Janeiro' },
                { value: '02', label: 'Fevereiro' },
                { value: '03', label: 'Março' },
                { value: '04', label: 'Abril' },
                { value: '05', label: 'Maio' },
                { value: '06', label: 'Junho' },
                { value: '07', label: 'Julho' },
                { value: '08', label: 'Agosto' },
                { value: '09', label: 'Setembro' },
                { value: '10', label: 'Outubro' },
                { value: '11', label: 'Novembro' },
                { value: '12', label: 'Dezembro' }
              ]
            },
            {
              id: 'ano',
              label: 'Ano',
              type: 'select',
              options: [
                { value: '2024', label: '2024' },
                { value: '2025', label: '2025' },
                { value: '2026', label: '2026' }
              ]
            }
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-6">
        {ordens.length > 0 ? ordens.map((ordem) => {
          const fatura = ordem.faturas?.[0];
          return (
            <div 
              key={ordem.id} 
              id={`oa-${ordem.id}`}
              className={`group relative overflow-hidden rounded-[2.5rem] bg-white p-6 md:p-8 shadow-sm ring-1 ring-black/5 transition-all hover:shadow-2xl hover:-translate-y-1 flex flex-col md:flex-row md:items-center justify-between gap-6 ${
                highlightedId === ordem.id 
                  ? 'bg-indigo-50/50 ring-2 ring-indigo-500 z-10 scale-[1.01]' 
                  : ''
              }`}
            >
              <div className={`absolute top-0 right-0 h-32 w-32 translate-x-12 -translate-y-12 rounded-full opacity-5 group-hover:opacity-10 transition-opacity ${
                ordem.status === 'concluido' ? 'bg-emerald-500' : 
                ordem.status === 'em_cancelamento' ? 'bg-indigo-500' :
                ordem.status === 'cancelado' ? 'bg-red-500' : 'bg-amber-500'
              }`} />
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 relative z-10">
                <div className={`flex h-16 w-16 items-center justify-center rounded-2xl shadow-inner group-hover:scale-110 transition-all ${
                  ordem.status === 'concluido' ? 'bg-emerald-50 text-emerald-600' : 
                  ordem.status === 'em_cancelamento' ? 'bg-indigo-50 text-indigo-600' :
                  ordem.status === 'cancelado' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                }`}>
                  <Calendar className="h-8 w-8" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-black text-neutral-900 uppercase tracking-tight group-hover:text-indigo-600 transition-colors">{ordem.assinaturas.nome}</h3>
                    <span className="text-[10px] font-mono text-neutral-400 bg-neutral-50 px-2 py-0.5 rounded border border-neutral-100">{ordem.codigo_ordem}</span>
                  </div>
                  <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mt-1">Cliente: {ordem.clientes.nome}</p>
                  <div className="flex items-center flex-wrap gap-3 mt-3">
                    <p className="text-xl font-black text-[#1a1a1a] tracking-tighter">{formatCurrency(ordem.assinaturas.valor)}</p>
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md shadow-sm ${
                      ordem.status === 'concluido' ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200' : 
                      ordem.status === 'em_cancelamento' ? 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200' :
                      ordem.status === 'cancelado' ? 'bg-red-50 text-red-600 ring-1 ring-red-200' :
                      'bg-amber-50 text-amber-600 ring-1 ring-amber-200'
                    }`}>
                      {ordem.status === 'concluido' ? 'Ativa' : 
                       ordem.status === 'em_cancelamento' ? 'Em Cancelamento' :
                       ordem.status === 'cancelado' ? 'Cancelada' : 'Pendente'}
                    </span>
                    {fatura && (
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md shadow-sm ${
                        fatura.status === 'pago' ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200' : 'bg-amber-50 text-amber-600 ring-1 ring-amber-200'
                      }`}>
                        {fatura.status === 'pago' ? 'Pago' : 'Aguardando Pagamento'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => { setSelectedOrdem(ordem); setIsDetailOpen(true); }}
                className="relative z-10 w-full md:w-auto rounded-2xl bg-indigo-600 md:bg-neutral-100 py-4 md:p-4 text-white md:text-neutral-400 hover:bg-indigo-700 md:hover:bg-[#1a1a1a] hover:text-white transition-all active:scale-95 shadow-lg shadow-indigo-600/20 md:shadow-sm text-[10px] font-black uppercase tracking-widest md:normal-case md:tracking-normal flex items-center justify-center gap-2"
              >
                <span className="md:hidden">Ver Detalhes</span>
                <MoreHorizontal className="hidden md:block h-6 w-6" />
              </button>
            </div>
          );
        }) : (
          <div className="py-24 text-center">
            <Calendar className="h-16 w-16 text-neutral-100 mx-auto mb-4" />
            <p className="text-[10px] font-black text-neutral-300 uppercase tracking-widest">Nenhuma ordem de assinatura {activeTab === 'processamento' ? 'em processamento' : activeTab === 'cancelado' ? 'cancelada' : 'ativa ou agendada'}</p>
          </div>
        )}
      </div>

      <Modal isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} title="Detalhes da Ordem de Assinatura" size="wide">
        {selectedOrdem && (
          <AssinaturaDetails 
            ordem={selectedOrdem}
            activeTab={activeTab}
            onOpenProrrogar={() => setIsProrrogarModalOpen(true)}
            onOpenCancelar={() => setIsCancelarModalOpen(true)}
            onUpdateStatus={handleUpdateStatus}
          />
        )}
      </Modal>

      <Modal
        isOpen={isProrrogarModalOpen}
        onClose={() => setIsProrrogarModalOpen(false)}
        title="Prorrogar Assinatura"
      >
        <div className="space-y-6">
          <p className="text-sm text-neutral-600">
            Quantos meses adicionais deseja prorrogar esta assinatura?
          </p>
          <div>
            <label className="block text-sm font-bold text-neutral-700 mb-1">Meses</label>
            <input
              type="number"
              min="1"
              value={mesesProrrogacao}
              onChange={(e) => setMesesProrrogacao(parseInt(e.target.value) || 1)}
              className="w-full rounded-xl border-neutral-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
          <button
            onClick={handleProrrogarAssinatura}
            className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-700"
          >
            Confirmar Prorrogação
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={isCancelarModalOpen}
        onClose={() => setIsCancelarModalOpen(false)}
        title="Cancelar Assinatura"
      >
        <div className="space-y-6">
          <p className="text-sm text-neutral-600">
            Selecione a data em que deseja cancelar a assinatura. Lembre-se que cancelamentos com menos de 30 dias de antecedência podem gerar cobranças proporcionais.
          </p>
          <div>
            <label className="block text-sm font-bold text-neutral-700 mb-1">Data de Cancelamento</label>
            <input
              type="date"
              min={new Date().toISOString().split('T')[0]}
              value={dataCancelamento}
              onChange={(e) => setDataCancelamento(e.target.value)}
              className="w-full rounded-xl border-neutral-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
          <button
            onClick={handleCancelarAssinatura}
            className="w-full rounded-xl bg-red-600 py-3 text-sm font-bold text-white hover:bg-red-700"
          >
            Confirmar Cancelamento
          </button>
        </div>
      </Modal>
    </div>
  );
}

export function AssinaturaDetails({ 
  ordem, 
  activeTab, 
  onOpenProrrogar, 
  onOpenCancelar, 
  onUpdateStatus 
}: { 
  ordem: any, 
  activeTab?: string, 
  onOpenProrrogar?: () => void, 
  onOpenCancelar?: () => void, 
  onUpdateStatus?: (id: string, status: 'concluido' | 'cancelado', motivo?: string) => void 
}) {
  const orcamento = Array.isArray(ordem.orcamentos) ? ordem.orcamentos[0] : ordem.orcamentos;
  
  const statusColors: Record<string, string> = {
    'em_analise': 'bg-amber-50 text-amber-600 ring-1 ring-amber-200/50',
    'em_cancelamento': 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200/50',
    'concluido': 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/50',
    'cancelado': 'bg-red-50 text-red-600 ring-1 ring-red-200/50',
    'pago': 'bg-blue-50 text-blue-600 ring-1 ring-blue-200/50',
    'pendente': 'bg-orange-50 text-orange-600 ring-1 ring-orange-200/50',
  };

  const statusLabels: Record<string, string> = {
    'em_analise': 'Em Processamento',
    'pago': 'Pago (Em Processamento)',
    'pendente': 'Pendente (Em Processamento)',
    'em_cancelamento': 'Em Cancelamento',
    'concluido': 'Ativa',
    'cancelado': 'Cancelada',
  };

  const displayLabel = statusLabels[ordem.status] || ordem.status;
  const badgeClass = statusColors[ordem.status] || 'bg-neutral-50 text-neutral-600 ring-1 ring-neutral-200';
  const isPulsing = ['em_analise', 'em_cancelamento', 'pago', 'pendente'].includes(ordem.status);

  return (
    <div className="space-y-6">
      {/* Alert Banners */}
      {ordem.status === 'cancelado' && (
        <div className="rounded-2xl bg-red-50 p-4 ring-1 ring-red-200/50 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-left">
            <h5 className="text-sm font-black text-red-900 uppercase">Assinatura Cancelada</h5>
            <p className="text-xs text-red-700 mt-1 leading-relaxed">
              Esta assinatura foi cancelada em {formatDate(ordem.data_cancelamento)}.
              {ordem.motivo_cancelamento && <><br/><strong>Motivo:</strong> {ordem.motivo_cancelamento}</>}
            </p>
          </div>
        </div>
      )}

      {ordem.status === 'em_cancelamento' && (
        <div className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200/50 flex items-start gap-3">
          <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-left">
            <h5 className="text-sm font-black text-amber-900 uppercase">Cancelamento Agendado</h5>
            <p className="text-xs text-amber-700 mt-1 leading-relaxed">
              A assinatura está programada para ser cancelada permanentemente em {formatDate(ordem.data_cancelamento)}. O valor proporcional estimado de devolução/estorno é de {formatCurrency(ordem.valor_proporcional_cancelamento || 0)}.
            </p>
          </div>
        </div>
      )}

      {/* Header do Modal */}
      <div className="rounded-3xl bg-neutral-50 p-5 ring-1 ring-neutral-200/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex gap-4 items-center">
          <div className="h-14 w-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
            <Layers className="h-6 w-6" />
          </div>
          <div className="text-left">
            <span className="text-[10px] font-mono font-black text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-100/50">
              {ordem.codigo_ordem || `#OA-${ordem.id.slice(0, 4).toUpperCase()}`}
            </span>
            <h3 className="text-xl font-black text-neutral-900 tracking-tight leading-tight mt-1">
              {ordem.assinaturas?.nome}
            </h3>
            <span className="text-xs font-bold text-neutral-500">{ordem.clientes?.nome}</span>
          </div>
        </div>
        <div className="text-left sm:text-right flex flex-col sm:items-end gap-2">
          <div className="flex items-center gap-2">
            <AdminWhatsAppButton 
              telefone={ordem.clientes?.telefone}
              mensagem={whatsappNotificationService.gerarMensagemWhatsApp({
                tipo: 'assinatura',
                clienteNome: ordem.clientes?.nome,
                codigo: ordem.codigo_ordem || `#OA-${ordem.id.slice(0, 4).toUpperCase()}`,
                status: ordem.status === 'concluido' ? 'Ativa' : ordem.status === 'em_cancelamento' ? 'Em Cancelamento' : ordem.status === 'cancelado' ? 'Cancelada' : 'Em Processamento'
              })}
            />
            <div className="text-right">
              <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block">Status do Contrato</span>
              <div className="mt-1">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider ${badgeClass}`}>
                  {isPulsing && (
                    <span className="h-2 w-2 rounded-full bg-current animate-ping" />
                  )}
                  {displayLabel}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Symmetrical Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Coluna da Direita: Detalhes & Vigência */}
        <div className="space-y-6 text-left">
          <div className="rounded-[2rem] bg-neutral-50 p-6 ring-1 ring-neutral-200/60">
            <h4 className="text-xs font-black text-neutral-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-1.5">
              <DollarSign className="h-4 w-4 text-indigo-500" /> Detalhes do Plano
            </h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block">Valor do Plano</span>
                <span className="text-lg font-black text-neutral-950 mt-1 block">
                  {formatCurrency(ordem.assinaturas?.valor || 0)}
                  <span className="text-xs text-neutral-400 font-bold"> /mês</span>
                </span>
              </div>
              <div>
                <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block">Vigência Ativa</span>
                <span className="text-base font-black text-neutral-800 mt-1.5 block">
                  {ordem.prazo_meses || 1} { (ordem.prazo_meses || 1) === 1 ? 'mês' : 'meses' }
                </span>
              </div>
              <div>
                <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block">Data de Início</span>
                <span className="text-sm font-bold text-neutral-700 mt-1 block">
                  {formatDate(ordem.data_inicio || ordem.data_criacao)}
                </span>
              </div>
              {ordem.data_vencimento && (
                <div>
                  <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block">Vencimento</span>
                  <span className="text-sm font-bold text-neutral-700 mt-1 block">
                    {formatDate(ordem.data_vencimento)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Ações de Gestão */}
          <div className="pt-2">
            {activeTab === 'processamento' && onUpdateStatus && (
              <div className="space-y-3">
                <button 
                  onClick={() => onUpdateStatus(ordem.id, 'concluido')}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white py-3 text-xs font-black uppercase tracking-widest transition-all shadow-md shadow-emerald-600/10 hover:shadow-lg hover:shadow-emerald-600/20"
                >
                  <CheckCircle className="h-4 w-4" /> Ativar Assinatura
                </button>
                <button 
                  onClick={() => onUpdateStatus(ordem.id, 'cancelado', 'Cancelado pelo administrador')}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-50 hover:bg-red-100 text-red-600 py-3 text-xs font-black uppercase tracking-widest transition-all ring-1 ring-red-100"
                >
                  <XCircle className="h-4 w-4" /> Cancelar Ordem
                </button>
              </div>
            )}
            
            {activeTab === 'concluido' && (
              <div className="space-y-3">
                {onOpenProrrogar && (
                  <button
                    onClick={onOpenProrrogar}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white py-3 text-xs font-black uppercase tracking-widest transition-all shadow-md shadow-emerald-600/10 hover:shadow-lg hover:shadow-emerald-600/20"
                  >
                    <Calendar className="h-4 w-4" /> Prorrogar Assinatura
                  </button>
                )}
                {ordem.status === 'concluido' && onOpenCancelar && (
                  <button
                    onClick={onOpenCancelar}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-50 hover:bg-red-100 text-red-600 py-3 text-xs font-black uppercase tracking-widest transition-all ring-1 ring-red-100"
                  >
                    <XCircle className="h-4 w-4" /> Cancelar Assinatura
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
