import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { formatCurrency, formatDate, formatDateTime } from '../../lib/utils';
import { 
  DollarSign, 
  ArrowUpRight, 
  ArrowDownRight, 
  Clock, 
  CheckCircle, 
  XCircle, 
  FileText,
  AlertCircle,
  Info,
  CreditCard,
  Calendar,
  ArrowDownCircle,
  Wallet,
  ShieldCheck,
  Copy
} from 'lucide-react';
import { notificationService } from '../../lib/notificationService';
import { toast } from 'react-hot-toast';
import { Modal } from '../ui/Modal';
import { motion } from 'framer-motion';
import { useProviderNotifications } from '../../hooks/useProviderNotifications';
import { logService } from '../../lib/logService';
import { useAutoFitTabs } from '../../hooks/useAutoFitTabs';

interface PrestadorFinanceiroProps {
  prestadorId: string;
}

export function PrestadorFinanceiro({ prestadorId, initialItemId }: PrestadorFinanceiroProps & { initialItemId?: string }) {
  const { pendencies } = useProviderNotifications();
  const { containerRef: financeiroTabsRef, setButtonRef: setFinanceiroTabButtonRef } = useAutoFitTabs(16, 10);
  const [activeTab, setActiveTab] = useState('extrato');
  const [transacoes, setTransacoes] = useState<any[]>([]);
  const [saques, setSaques] = useState<any[]>([]);
  const [prestador, setPrestador] = useState<any>(null);
  const [saldo, setSaldo] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedDemandaDetails, setSelectedDemandaDetails] = useState<any>(null);

  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);

  useEffect(() => {
    if (initialItemId && (transacoes.length > 0 || saques.length > 0)) {
      const transacao = transacoes.find(t => t.id === initialItemId);
      const saque = saques.find(s => s.id === initialItemId);

      if (transacao) {
        setActiveTab('extrato');
        if (transacao.demanda) {
          setSelectedDemandaDetails(transacao.demanda);
        }
        setTimeout(() => {
          const element = document.getElementById(`transacao-${initialItemId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHighlightedItemId(initialItemId);
            setTimeout(() => setHighlightedItemId(null), 3000);
          }
        }, 400);
      } else if (saque) {
        setActiveTab('saques');
        setSelectedSaque(saque);
        setIsSaqueDetailOpen(true);
        setTimeout(() => {
          const element = document.getElementById(`saque-${initialItemId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHighlightedItemId(initialItemId);
            setTimeout(() => setHighlightedItemId(null), 3000);
          }
        }, 400);
      }
    }
  }, [initialItemId, transacoes.length, saques.length]);

  // Withdrawal Modal State
  const [isSaqueModalOpen, setIsSaqueModalOpen] = useState(false);
  const [saqueStep, setSaqueStep] = useState(1);
  const [saqueFormData, setSaqueFormData] = useState({ tipo_chave_pix: '', chave_pix: '' });
  
  // Detail Modal State
  const [selectedSaque, setSelectedSaque] = useState<any>(null);
  const [isSaqueDetailOpen, setIsSaqueDetailOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel(`prestador-financeiro-${prestadorId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prestador_transacoes', filter: `prestador_id=eq.${prestadorId}` }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prestador_saques', filter: `prestador_id=eq.${prestadorId}` }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'prestadores', filter: `id=eq.${prestadorId}` }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [prestadorId]);

  const fetchData = async () => {
    try {
      // Fetch Prestador
      const { data: prestadorData, error: prestadorError } = await supabase
        .from('prestadores')
        .select('*')
        .eq('id', prestadorId)
        .single();
      
      if (prestadorError) throw prestadorError;
      setPrestador(prestadorData);

      // Fetch Transacoes
      const { data: transacoesData, error: transacoesError } = await supabase
        .from('prestador_transacoes')
        .select('*, demanda:prestador_demandas(*, ordem_servico:ordens_servico(*))')
        .eq('prestador_id', prestadorId)
        .order('created_at', { ascending: false });

      if (transacoesError) throw transacoesError;
      setTransacoes(transacoesData || []);

      // Calculate Saldo
      const totalCreditos = (transacoesData || []).filter(t => t.status === 'concluido' && t.tipo === 'credito').reduce((acc, t) => acc + Number(t.valor), 0);
      const totalDebitos = (transacoesData || []).filter(t => t.status === 'concluido' && t.tipo === 'debito').reduce((acc, t) => acc + Number(t.valor), 0);
      setSaldo(totalCreditos - totalDebitos);

      // Fetch Saques
      const { data: saquesData, error: saquesError } = await supabase
        .from('prestador_saques')
        .select('*')
        .eq('prestador_id', prestadorId)
        .order('created_at', { ascending: false });

      if (saquesError) throw saquesError;
      setSaques(saquesData || []);

    } catch (error) {
      console.error('Erro ao buscar dados financeiros:', error);
      toast.error('Erro ao carregar dados financeiros.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestWithdrawal = async () => {
    if (isSubmitting) return;
    if (saldo <= 0) {
      toast.error('Saldo insuficiente para saque.');
      return;
    }

    if (!saqueFormData.tipo_chave_pix || !saqueFormData.chave_pix) {
      toast.error('Informe os dados do PIX.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create saque request (using 'pendente' to match admin expectation)
      const { data: saqueData, error: saqueError } = await supabase
        .from('prestador_saques')
        .insert({
          prestador_id: prestadorId,
          valor: saldo,
          valor_liquido: saldo, // Fee is 0
          taxa_aplicada: 0,
          tipo_chave_pix: saqueFormData.tipo_chave_pix,
          chave_pix: saqueFormData.chave_pix,
          status: 'pendente',
          data_vencimento: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        })
        .select()
        .single();

      if (saqueError) throw saqueError;

      // 2. Create debit transaction (starts as 'concluido' to debit wallet immediately)
      const { error: transacaoError } = await supabase
        .from('prestador_transacoes')
        .insert({
          prestador_id: prestadorId,
          tipo: 'debito',
          valor: saldo,
          descricao: `Solicitação de Saque (PIX: ${saqueFormData.tipo_chave_pix.toUpperCase()})`,
          status: 'concluido'
        });

      if (transacaoError) {
        if (saqueData?.id) {
          await supabase.from('prestador_saques').delete().eq('id', saqueData.id);
        }
        throw transacaoError;
      }

      await logService.logAction({
        ator_tipo: 'prestador',
        ator_id: prestadorId,
        acao: 'SOLICITAR_SAQUE',
        detalhes: `Solicitou saque total de ${formatCurrency(saldo)} via PIX`
      });

      await notificationService.notifyAdmin(
        'Novo Saque Solicitado',
        `Um prestador solicitou o saque de sua comissão no valor de ${formatCurrency(saldo)}. Acesse o painel financeiro para aprovar a transferência e enviar o comprovante.`,
        'financeiro',
        'transferencia_solicitada',
        { itemId: saqueData?.id, tab: 'saques_rede' }
      );

      toast.success('Solicitação de saque enviada com sucesso!');
      
      toast('O prazo para pagamento é de no máximo até 07 dias úteis.', { 
        icon: 'ℹ️',
        duration: 8000,
        position: 'top-center',
        style: {
          borderRadius: '16px',
          background: '#333',
          color: '#fff',
          fontWeight: 'bold'
        }
      });

      setIsSaqueModalOpen(false);
      setSaqueStep(1);
      setSaqueFormData({ tipo_chave_pix: '', chave_pix: '' });
      fetchData();

    } catch (error: any) {
      console.error('Erro ao solicitar saque:', error);
      toast.error('Erro ao solicitar saque: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelSaque = (saque: any) => {
    if (saque.status !== 'pendente') return;
    setIsCancelling(true);
    setCancelReason('');
  };

  const confirmCancelSaque = async () => {
    if (!selectedSaque) return;
    if (!cancelReason.trim()) return toast.error('O motivo é obrigatório.');

    try {
      // 1. Update status
      const { data, error } = await supabase
        .from('prestador_saques')
        .update({ 
          status: 'cancelado', 
          motivo_cancelamento: cancelReason,
          observacao: cancelReason
        })
        .eq('id', selectedSaque.id)
        .eq('status', 'pendente')
        .select();

      if (error || !data || data.length === 0) {
        throw new Error('Erro ao cancelar saque. O status pode ter mudado.');
      }

      // 2. Refund to wallet
      const { error: transacaoError } = await supabase
        .from('prestador_transacoes')
        .insert({
          prestador_id: prestadorId,
          tipo: 'credito',
          valor: selectedSaque.valor,
          descricao: `Estorno de saque cancelado (${selectedSaque.id.slice(0, 8)})`,
          status: 'concluido'
        });

      if (transacaoError) {
        await supabase
          .from('prestador_saques')
          .update({ 
            status: 'pendente', 
            motivo_cancelamento: null,
            observacao: null
          })
          .eq('id', selectedSaque.id);
        throw transacaoError;
      }

      toast.success('Saque cancelado e valor retornado à carteira.');
      setIsSaqueDetailOpen(false);
      setIsCancelling(false);
      fetchData();

    } catch (error: any) {
      toast.error(error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1a1a1a] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Wallet Card - Standardized with Client Style */}
      <div className="grid grid-cols-1 gap-6">
        <div className="rounded-[2rem] bg-[#1a1a1a] p-6 sm:p-8 ring-1 ring-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none"></div>
          
          <div className="flex items-center gap-6 relative z-10">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 backdrop-blur-sm ring-1 ring-white/10 shrink-0">
              <CreditCard className="h-8 w-8 text-white/90" />
            </div>
            <div>
              <p className="text-[10px] font-semibold tracking-widest text-white/50 uppercase">Saldo em Carteira</p>
              <p className="mt-1 text-4xl tracking-tight text-white">
                {formatCurrency(saldo)}
              </p>
              <p className="mt-2 text-[10px] text-white/40">Taxa de Saque: Gratuita para Prestadores</p>
            </div>
          </div>
          <div className="flex flex-col sm:items-end gap-4 relative z-10">
            {saldo > 0 && (
              <button 
                onClick={() => setIsSaqueModalOpen(true)}
                className="w-full sm:w-auto rounded-full bg-white px-8 py-3.5 text-sm font-bold text-[#1a1a1a] hover:bg-neutral-200 transition-colors shadow-lg"
              >
                Solicitar Saque
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="w-full">
        <div ref={financeiroTabsRef} className="flex w-full gap-1 rounded-3xl bg-neutral-100 p-1 ring-1 ring-neutral-200">
          {['extrato', 'saques'].map((t, index) => {
            let badge = 0;
            if (t === 'saques') badge = pendencies.financeiro_saques_pendentes;
            
            return (
              <button 
                key={t}
                ref={setFinanceiroTabButtonRef(index)}
                onClick={() => setActiveTab(t)}
                className={`flex min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-2xl px-1.5 py-2.5 font-black capitalize leading-none transition-all sm:gap-2 sm:px-6 ${activeTab === t ? 'bg-white text-emerald-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}`}
              >
                {t}
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

      {/* Content */}
      <div className="min-h-[400px]">
        {activeTab === 'extrato' && (
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
            {transacoes.length === 0 ? (
              <p className="py-12 text-center text-neutral-400 font-medium">Nenhuma movimentação registrada.</p>
            ) : (
              <div className="space-y-4">
                {transacoes.map((item) => (
                  <div 
                    id={`transacao-${item.id}`}
                    key={item.id} 
                    className={`flex items-center justify-between border-b border-neutral-100 pb-4 last:border-0 last:pb-0 transition-all duration-500 ${
                      highlightedItemId === item.id 
                        ? 'bg-indigo-50/50 ring-2 ring-indigo-500 scale-[1.01] z-10 shadow-lg rounded-xl p-2' 
                        : ''
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${item.tipo === 'credito' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                        {item.tipo === 'credito' ? <ArrowDownCircle className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                      </div>
                      <div>
                        <p className="font-medium text-neutral-900">
                          {item.tipo === 'credito' && item.demanda
                            ? `Pagamento pela Demanda nº ${item.demanda.codigo_demanda || `#${item.demanda.id?.slice(0, 8)}`} Finalizada.`
                            : item.descricao}
                        </p>
                        <p className="text-xs text-neutral-500">{formatDateTime(item.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className={`font-bold ${item.tipo === 'credito' ? 'text-emerald-600' : 'text-red-600'}`}>
                          {item.tipo === 'credito' ? '+' : '-'} {formatCurrency(item.valor)}
                        </p>
                        <span className={`text-[10px] font-bold uppercase ${item.status === 'concluido' ? 'text-emerald-500' : item.status === 'pendente' ? 'text-amber-500' : 'text-red-500'}`}>
                          {item.status}
                        </span>
                      </div>
                      {item.demanda && (
                        <button
                          onClick={() => setSelectedDemandaDetails(item.demanda)}
                          className="rounded-lg bg-neutral-100 p-2 text-neutral-600 hover:bg-neutral-200 transition-colors"
                        >
                          <FileText className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'saques' && (
          <div className="space-y-4">
            {saques.length === 0 ? (
              <div className="rounded-3xl bg-white ring-1 ring-neutral-200 overflow-hidden">
                <p className="py-12 text-center text-neutral-400">Nenhum saque solicitado.</p>
              </div>
            ) : (
              saques.map(saque => (
                <div 
                  id={`saque-${saque.id}`}
                  key={saque.id} 
                  className={`flex flex-col sm:flex-row sm:items-center justify-between border-b border-neutral-100 pb-4 last:border-0 last:pb-0 bg-white p-6 rounded-2xl shadow-sm ring-1 ring-neutral-200 transition-all duration-500 ${
                    highlightedItemId === saque.id 
                      ? 'bg-indigo-50/50 ring-2 ring-indigo-500 scale-[1.01] z-10 shadow-lg' 
                      : ''
                  }`}
                >
                  <div className="flex items-center gap-4 mb-4 sm:mb-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shrink-0">
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-neutral-900">Saque Solicitado</p>
                      <p className="text-xs text-neutral-500">{formatDateTime(saque.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:flex-col sm:items-end gap-2 sm:gap-1">
                    <p className="font-bold text-neutral-900">
                      {formatCurrency(saque.valor)}
                    </p>
                    <div className="flex items-center gap-3">
                      <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${
                        saque.status === 'pendente' || saque.status === 'em_analise' ? 'bg-amber-100 text-amber-700' : 
                        saque.status === 'pago' || saque.status === 'aprovado' ? 'bg-emerald-100 text-emerald-700' : 
                        saque.status === 'cancelado' || saque.status === 'rejeitado' ? 'bg-red-100 text-red-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {saque.status === 'cancelado' ? 'Recusado' : saque.status.replace('_', ' ')}
                      </span>
                      <button 
                        onClick={() => { setSelectedSaque(saque); setIsSaqueDetailOpen(true); }}
                        className="text-xs font-bold text-emerald-600 hover:underline"
                      >
                        Detalhes
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Withdrawal Request Modal */}
      <Modal isOpen={isSaqueModalOpen} onClose={() => setIsSaqueModalOpen(false)} title="Solicitar Saque" size="full">
        <div className="space-y-8">
          {saqueStep === 1 ? (
            <div className="space-y-6">
              <div className="rounded-2xl bg-emerald-50 p-6 ring-1 ring-emerald-100">
                <h4 className="font-bold text-emerald-900 mb-4 flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  Confirme seus dados
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs font-bold text-emerald-400 uppercase">Nome/Razão</p>
                    <p className="font-bold text-emerald-900">{prestador?.nome_razao}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-emerald-400 uppercase">Documento</p>
                    <p className="font-bold text-emerald-900">{prestador?.documento}</p>
                  </div>
                </div>
              </div>
              <p className="text-sm text-neutral-500">Para prosseguir com o saque, confirme se as informações acima estão corretas. O pagamento será realizado exclusivamente para contas vinculadas a este documento.</p>
              <button 
                onClick={() => setSaqueStep(2)}
                className="w-full rounded-2xl bg-[#1a1a1a] py-4 font-bold text-white shadow-xl hover:bg-black"
              >
                Confirmar e Prosseguir
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="rounded-2xl bg-neutral-50 p-6 ring-1 ring-neutral-200">
                <p className="text-xs font-bold text-neutral-400 uppercase mb-1">Valor do Saque (Total)</p>
                <p className="text-3xl font-black text-neutral-900">{formatCurrency(saldo)}</p>
                
                <div className="mt-4 pt-4 border-t border-neutral-200 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-500">Taxa de Saque (Isento)</span>
                    <span className="font-medium text-emerald-600">Gratuito</span>
                  </div>
                  <div className="flex justify-between text-base font-bold">
                    <span className="text-neutral-900">Valor Líquido a Receber</span>
                    <span className="text-emerald-600">{formatCurrency(saldo)}</span>
                  </div>
                </div>
                
                <p className="text-[10px] text-neutral-400 mt-4 italic">* Somente é permitido o saque do valor total em carteira.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-bold text-neutral-700">Tipo de Chave PIX</label>
                  <select 
                    value={saqueFormData.tipo_chave_pix}
                    onChange={e => {
                      const tipo = e.target.value;
                      let chave = saqueFormData.chave_pix;
                      if (tipo === 'cpf' || tipo === 'cnpj') chave = prestador?.documento || '';
                      if (tipo === 'email') chave = prestador?.email || '';
                      if (tipo === 'telefone') chave = prestador?.telefone || '';
                      if (tipo === 'aleatoria') chave = '';
                      setSaqueFormData({...saqueFormData, tipo_chave_pix: tipo, chave_pix: chave});
                    }}
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">Selecione...</option>
                    <option value="cpf">CPF</option>
                    <option value="cnpj">CNPJ</option>
                    <option value="email">E-mail</option>
                    <option value="telefone">Telefone</option>
                    <option value="aleatoria">Chave Aleatória</option>
                  </select>
                </div>

                {saqueFormData.tipo_chave_pix && (
                  <div>
                    <label className="mb-1 block text-sm font-bold text-neutral-700">Chave PIX</label>
                    <input 
                      type="text" 
                      inputMode={['cpf', 'cnpj', 'telefone'].includes(saqueFormData.tipo_chave_pix) ? 'numeric' : 'text'}
                      pattern={['cpf', 'cnpj', 'telefone'].includes(saqueFormData.tipo_chave_pix) ? '[0-9]*' : undefined}
                      placeholder="Informe sua chave PIX..." 
                      value={saqueFormData.chave_pix}
                      onChange={e => setSaqueFormData({...saqueFormData, chave_pix: e.target.value})}
                      readOnly={saqueFormData.tipo_chave_pix === 'cpf' || saqueFormData.tipo_chave_pix === 'cnpj'}
                      className={`w-full rounded-xl border px-4 py-3 focus:outline-none ${saqueFormData.tipo_chave_pix === 'cpf' || saqueFormData.tipo_chave_pix === 'cnpj' ? 'bg-neutral-200 border-neutral-300 text-neutral-500 cursor-not-allowed' : 'bg-neutral-50 border-neutral-200 focus:border-emerald-500'}`}
                    />
                  </div>
                )}
                
                <div className="rounded-xl bg-blue-50 p-4 ring-1 ring-blue-100 flex items-start gap-3 mt-4">
                  <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-sm font-medium text-blue-800">
                    Qualquer solicitação de saque somente será efetivada no nome do titular da conta.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setSaqueStep(1)}
                  className="flex-1 rounded-2xl border border-neutral-200 py-4 font-bold text-neutral-600 hover:bg-neutral-50"
                >
                  Voltar
                </button>
                <button 
                  disabled={!saqueFormData.tipo_chave_pix || !saqueFormData.chave_pix || isSubmitting}
                  onClick={handleRequestWithdrawal}
                  className="flex-1 rounded-2xl bg-[#1a1a1a] py-4 font-bold text-white shadow-xl hover:bg-black disabled:opacity-50"
                >
                  {isSubmitting ? 'Processando...' : 'Solicitar Saque'}
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Saque Detail Modal */}
      <Modal isOpen={isSaqueDetailOpen} onClose={() => setIsSaqueDetailOpen(false)} title={isCancelling ? "Cancelar Saque" : "Detalhes do Saque"} size="full">
        {selectedSaque && (
          isCancelling ? (
            <div className="space-y-6">
              <div className="rounded-2xl bg-red-50 p-6 ring-1 ring-red-100">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800 font-medium">
                    Você tem certeza que deseja cancelar este saque? O valor será estornado para sua carteira imediatamente.
                  </p>
                </div>
                <div className="mt-6">
                  <label className="block text-xs font-bold text-red-700 uppercase mb-2">Motivo do Cancelamento</label>
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Informe o motivo..."
                    className="w-full rounded-xl border border-red-200 bg-white p-3 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                    rows={3}
                  />
                </div>
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={() => setIsCancelling(false)}
                  className="flex-1 rounded-2xl border border-neutral-200 py-4 font-bold text-neutral-600 hover:bg-neutral-50"
                >
                  Voltar
                </button>
                <button 
                  onClick={confirmCancelSaque}
                  className="flex-1 rounded-2xl bg-red-600 py-4 font-bold text-white shadow-xl hover:bg-red-700"
                >
                  Confirmar Cancelamento
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="rounded-2xl bg-[#f8f7f5] p-6 ring-1 ring-black/5">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="text-[10px] font-semibold tracking-widest text-[#1a1a1a]/40 uppercase">Status</p>
                    <span className={`inline-block rounded-full px-3 py-1 text-[10px] font-bold tracking-widest uppercase mt-2 ${
                      selectedSaque.status === 'pendente' || selectedSaque.status === 'em_analise' ? 'bg-amber-100 text-amber-700' : 
                      selectedSaque.status === 'pago' || selectedSaque.status === 'aprovado' ? 'bg-emerald-100 text-emerald-700' : 
                      selectedSaque.status === 'cancelado' || selectedSaque.status === 'rejeitado' ? 'bg-red-100 text-red-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {selectedSaque.status === 'cancelado' ? 'Recusado' : selectedSaque.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-semibold tracking-widest text-[#1a1a1a]/40 uppercase">Data Solicitação</p>
                    <p className="font-medium text-[#1a1a1a] mt-1">{formatDateTime(selectedSaque.created_at)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-[10px] font-semibold tracking-widest text-[#1a1a1a]/40 uppercase">Valor Solicitado</p>
                    <p className="text-2xl tracking-tight text-[#1a1a1a] mt-1">{formatCurrency(selectedSaque.valor)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold tracking-widest text-[#1a1a1a]/40 uppercase">Chave PIX ({selectedSaque.tipo_chave_pix || 'PIX'})</p>
                    <p className="font-medium text-[#1a1a1a] mt-1">{selectedSaque.chave_pix || 'Verifique sua solicitação'}</p>
                  </div>
                  
                  {(selectedSaque.status === 'pendente' || selectedSaque.status === 'em_analise') && (
                    <div className="col-span-2 rounded-2xl bg-amber-50 p-5 ring-1 ring-amber-100">
                      <p className="text-[10px] font-semibold tracking-widest text-amber-700 uppercase">Previsão de Pagamento</p>
                      <p className="font-medium text-amber-900 mt-1">
                        {selectedSaque.data_vencimento ? formatDate(selectedSaque.data_vencimento) : 'Até 7 dias úteis'}
                      </p>
                      <p className="mt-2 text-xs text-amber-600/80">O pagamento será realizado até esta data.</p>
                    </div>
                  )}
                </div>

                {selectedSaque.status === 'pago' && (
                  <div className="mt-6 border-t border-black/5 pt-6">
                    <p className="text-[10px] font-semibold tracking-widest text-[#1a1a1a]/40 uppercase">Data do Pagamento</p>
                    <p className="font-medium text-emerald-600 mt-1">{selectedSaque.data_pagamento ? formatDateTime(selectedSaque.data_pagamento) : 'Pago'}</p>
                  </div>
                )}

                {(selectedSaque.status === 'cancelado' || selectedSaque.status === 'rejeitado') && (
                  <div className="mt-6 border-t border-black/5 pt-6">
                    <p className="text-[10px] font-semibold tracking-widest text-red-600 uppercase">Motivo</p>
                    <p className="font-medium text-red-600 mt-1">{selectedSaque.observacao || selectedSaque.motivo_cancelamento || 'Não informado'}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-4">
                {(selectedSaque.status === 'pendente' || selectedSaque.status === 'em_analise') && (
                  <button 
                    onClick={() => handleCancelSaque(selectedSaque)}
                    className="flex-1 flex items-center justify-center gap-2 rounded-full bg-red-50 py-4 font-medium text-red-600 hover:bg-red-100 transition-colors"
                  >
                    <XCircle className="h-5 w-5" />
                    Cancelar Saque
                  </button>
                )}
                <button 
                  onClick={() => setIsSaqueDetailOpen(false)}
                  className="flex-1 rounded-full border border-neutral-200 py-4 font-medium text-neutral-600 hover:bg-neutral-50"
                >
                  Fechar
                </button>
              </div>
            </div>
          )
        )}
      </Modal>

      {/* Demanda Details Modal */}
      <Modal
        isOpen={!!selectedDemandaDetails}
        onClose={() => setSelectedDemandaDetails(null)}
        title="Detalhes da Demanda"
        size="full"
      >
        {selectedDemandaDetails && (
          <div className="space-y-6">
            <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200">
              <h4 className="font-semibold text-neutral-900 mb-2">Informações Gerais</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-neutral-500 block">Nº Demanda</span>
                  <span className="font-bold text-purple-700 bg-purple-50 inline-block px-2 py-0.5 rounded-md ring-1 ring-purple-100 mt-1">
                    {selectedDemandaDetails.codigo_demanda || `#${selectedDemandaDetails.id?.slice(0, 8)}`}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-500 block">Título</span>
                  <span className="font-medium text-neutral-900">{selectedDemandaDetails.titulo}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block">OS Vinculada</span>
                  <span className="font-medium text-neutral-900">
                    {selectedDemandaDetails.ordem_servico?.codigo_os || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-500 block">Status</span>
                  <span className="font-medium text-neutral-900">{selectedDemandaDetails.status}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block">Valor Final</span>
                  <span className="font-medium text-emerald-600">{formatCurrency(selectedDemandaDetails.valor_final)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
