import React, { useState, useEffect, useMemo } from 'react';
import { 
  Landmark, DollarSign, Clock, CheckCircle2, XCircle, FileText,
  Upload, Percent, ShieldCheck, User, RefreshCw, Eye, Plus,
  Send, Scale, Gavel, Layers, AlertTriangle, ArrowRight, MessageSquare
} from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { useRealtimeSubscription } from '../../../../hooks/useRealtime';
import { callAdminRpc } from '../../../../lib/adminRpc';
import { formatCurrency, formatDate, formatDateTime, maskCurrency } from '../../../../lib/utils';
import { toast } from 'react-hot-toast';
import { calcularPerfilRisco } from '../../../../utils/riskProfile';
import { notificationService } from '../../../../lib/notificationService';
import { logService } from '../../../../lib/logService';
import { TacticalDataGrid, GridColumn } from '../shared/TacticalDataGrid';
import { CommandSlideOver } from '../shared/CommandSlideOver';
import { StatusBadge } from '../shared/StatusBadge';
import { CreditDisputesAdminPanel } from './CreditDisputesAdminPanel';
import { CreditLimitCancellationsAdminPanel } from './CreditLimitCancellationsAdminPanel';
import { CreditWithdrawalsAdminPanel } from './CreditWithdrawalsAdminPanel';

export interface EmprestimosCreditoViewProps {
  initialSubTab?: 'emprestimos' | 'credito' | 'contestacoes' | 'cancelamentos_limite' | 'saques_credito';
  initialItemId?: string;
  colaboradorNome?: string;
  colaboradorId?: string;
}

export function EmprestimosCreditoView({
  initialSubTab = 'emprestimos',
  initialItemId,
  colaboradorNome,
  colaboradorId
}: EmprestimosCreditoViewProps) {
  const [activeTab, setActiveTab] = useState<'emprestimos' | 'credito' | 'contestacoes' | 'cancelamentos_limite' | 'saques_credito'>(initialSubTab);

  // ── Empréstimos State ──────────────────────────────────────────────────
  const [emprestimos, setEmprestimos] = useState<any[]>([]);
  const [selectedEmprestimo, setSelectedEmprestimo] = useState<any | null>(null);
  const [isEmprestimoDrawerOpen, setIsEmprestimoDrawerOpen] = useState(false);
  const [loadingEmprestimos, setLoadingEmprestimos] = useState(true);

  // Proposal Drawer
  const [isProposalDrawerOpen, setIsProposalDrawerOpen] = useState(false);
  const [proposalData, setProposalData] = useState({
    valorAprovado: '',
    taxaJuros: '3.5',
    prazoMeses: '12',
    taxaServico: '50',
    mensagem: 'Proposta de microcrédito aprovada pela mesa de crédito GSA.',
    validadeDias: 7
  });
  const [submittingProposal, setSubmittingProposal] = useState(false);

  // Payoff Offer Drawer
  const [isPayoffDrawerOpen, setIsPayoffDrawerOpen] = useState(false);
  const [payoffValor, setPayoffValor] = useState('');
  const [submittingPayoff, setSubmittingPayoff] = useState(false);

  // ── Crédito da Loja State ──────────────────────────────────────────────
  const [creditoSolicitacoes, setCreditoSolicitacoes] = useState<any[]>([]);
  const [selectedCredito, setSelectedCredito] = useState<any | null>(null);
  const [isCreditoDrawerOpen, setIsCreditoDrawerOpen] = useState(false);
  const [loadingCredito, setLoadingCredito] = useState(true);

  // Pre-Approve Credit Drawer
  const [isPreApproveDrawerOpen, setIsPreApproveDrawerOpen] = useState(false);
  const [creditLimitAprovado, setCreditLimitAprovado] = useState('');
  const [submittingPreApprove, setSubmittingPreApprove] = useState(false);

  // ── Fetching Data ──────────────────────────────────────────────────────
  const fetchEmprestimos = async () => {
    setLoadingEmprestimos(true);
    try {
      const { data, error } = await supabase
        .from('emprestimos')
        .select(`
          *,
          clientes(id, nome, cpf, cnpj, email, telefone, saldo_carteira, codigo_cliente),
          emprestimo_parcelas(id, numero_parcela, valor, data_vencimento, status),
          emprestimo_documentos(id, tipo, arquivo_url, status)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        setEmprestimos(data);
        if (initialItemId && activeTab === 'emprestimos') {
          const emp = data.find((e: any) => e.id === initialItemId);
          if (emp) {
            setSelectedEmprestimo(emp);
            setIsEmprestimoDrawerOpen(true);
          }
        }
      }
    } catch (err) {
      console.error('Erro ao buscar empréstimos:', err);
    } finally {
      setLoadingEmprestimos(false);
    }
  };

  const fetchCredito = async () => {
    setLoadingCredito(true);
    try {
      const { data, error } = await supabase
        .from('loja_credito_solicitacoes')
        .select(`
          *,
          clientes(id, nome, cpf, cnpj, email, telefone, codigo_cliente)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        setCreditoSolicitacoes(data);
        if (initialItemId && activeTab === 'credito') {
          const cred = data.find((c: any) => c.id === initialItemId);
          if (cred) {
            setSelectedCredito(cred);
            setIsCreditoDrawerOpen(true);
          }
        }
      }
    } catch (err) {
      console.error('Erro ao buscar solicitações de crédito:', err);
    } finally {
      setLoadingCredito(false);
    }
  };

  useEffect(() => {
    fetchEmprestimos();
    fetchCredito();
  }, []);

  useRealtimeSubscription([
    { table: 'emprestimos', onChange: fetchEmprestimos },
    { table: 'emprestimo_parcelas', onChange: fetchEmprestimos },
    { table: 'loja_credito_solicitacoes', onChange: fetchCredito }
  ]);

  // ── Empréstimo Actions ─────────────────────────────────────────────────
  const handleEnviarProposta = async () => {
    if (!selectedEmprestimo) return;
    const numValor = Number(proposalData.valorAprovado.replace(/[^\d]/g, '')) / 100;
    if (isNaN(numValor) || numValor <= 0) {
      toast.error('Informe um valor de crédito válido.');
      return;
    }

    setSubmittingProposal(true);
    try {
      const res = await callAdminRpc<any>('gsa_admin_emprestimo_enviar_proposta', {
        p_emprestimo_id: selectedEmprestimo.id,
        p_valor_aprovado: numValor,
        p_taxa_juros: Number(proposalData.taxaJuros),
        p_prazo_meses: Number(proposalData.prazoMeses),
        p_taxa_servico: Number(proposalData.taxaServico),
        p_mensagem: proposalData.mensagem,
        p_validade_dias: Number(proposalData.validadeDias)
      });

      if (res && !res.success) throw new Error(res.error || 'Erro ao enviar proposta.');

      toast.success('Proposta de empréstimo enviada ao cliente com sucesso!');
      setIsProposalDrawerOpen(false);
      setIsEmprestimoDrawerOpen(false);
      fetchEmprestimos();
    } catch (err: any) {
      console.error('Erro ao enviar proposta:', err);
      toast.error(err?.message || 'Erro ao enviar proposta.');
    } finally {
      setSubmittingProposal(false);
    }
  };

  const handleAprovarEmprestimoDireto = async (emp: any) => {
    try {
      const res = await callAdminRpc<any>('gsa_admin_emprestimo_aprovar', {
        p_emprestimo_id: emp.id
      });
      if (res && !res.success) throw new Error(res.error || 'Erro ao aprovar.');
      toast.success('Empréstimo aprovado com sucesso!');
      fetchEmprestimos();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao aprovar empréstimo.');
    }
  };

  const handleEnviarOfertaQuitacao = async () => {
    if (!selectedEmprestimo) return;
    const numValor = Number(payoffValor.replace(/[^\d]/g, '')) / 100;
    if (isNaN(numValor) || numValor <= 0) {
      toast.error('Informe um valor de quitação válido.');
      return;
    }

    setSubmittingPayoff(true);
    try {
      const res = await callAdminRpc<any>('gsa_admin_emprestimo_enviar_oferta_quitacao', {
        p_emprestimo_id: selectedEmprestimo.id,
        p_valor_oferta: numValor
      });
      if (res && !res.success) throw new Error(res.error || 'Erro ao enviar oferta.');
      toast.success('Oferta de quitação antecipada enviada ao cliente!');
      setIsPayoffDrawerOpen(false);
      fetchEmprestimos();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao enviar oferta de quitação.');
    } finally {
      setSubmittingPayoff(false);
    }
  };

  // ── Crédito Actions ────────────────────────────────────────────────────
  const handlePreAprovarCredito = async () => {
    if (!selectedCredito) return;
    if (selectedCredito.origem_pre_aprovado) {
      setSubmittingPreApprove(true);
      try {
        const res = await callAdminRpc<any>('gsa_admin_approve_preapproved_credit_100', { p_solicitacao_id: selectedCredito.id });
        if (res && !res.success) throw new Error(res.error || 'Erro ao liberar crédito.');
        toast.success('Crédito pré-aprovado de R$ 100,00 liberado para o cliente.');
        setIsPreApproveDrawerOpen(false); setIsCreditoDrawerOpen(false); fetchCredito();
      } catch (err: any) { toast.error(err?.message || 'Erro ao liberar crédito.'); }
      finally { setSubmittingPreApprove(false); }
      return;
    }
    const numValor = Number(creditLimitAprovado.replace(/[^\d]/g, '')) / 100;
    if (isNaN(numValor) || numValor <= 0) {
      toast.error('Informe o limite de crédito aprovado.');
      return;
    }

    setSubmittingPreApprove(true);
    try {
      const res = await callAdminRpc<any>('gsa_admin_preaprovar_credito', {
        p_solicitacao_id: selectedCredito.id,
        p_limite_aprovado: numValor
      });
      if (res && !res.success) throw new Error(res.error || 'Erro ao pré-aprovar crédito.');
      toast.success('Crédito pré-aprovado com sucesso!');
      setIsPreApproveDrawerOpen(false);
      setIsCreditoDrawerOpen(false);
      fetchCredito();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao pré-aprovar crédito.');
    } finally {
      setSubmittingPreApprove(false);
    }
  };

  const handleRecusarCredito = async (cred: any) => {
    const reason = prompt('Informe a justificativa da recusa de crédito:');
    if (!reason || !reason.trim()) return;

    try {
      const res = await callAdminRpc<any>('gsa_admin_recusar_credito', {
        p_solicitacao_id: cred.id,
        p_motivo: reason.trim()
      });
      if (res && !res.success) throw new Error(res.error || 'Erro ao recusar crédito.');
      toast.success('Solicitação de crédito recusada.');
      fetchCredito();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao recusar crédito.');
    }
  };

  // ── Grid Columns: Empréstimos ──────────────────────────────────────────
  const emprestimoColumns: GridColumn<any>[] = [
    {
      key: 'id',
      header: 'Contrato / Protocolo',
      width: '140px',
      render: (row) => (
        <span className="font-mono font-bold text-slate-900 text-xs">
          #{row.id.slice(0, 8)}
        </span>
      )
    },
    {
      key: 'cliente',
      header: 'Cliente / Proponente',
      render: (row) => (
        <div>
          <p className="font-semibold text-slate-900 text-xs truncate">
            {row.clientes?.nome || 'Cliente não identificado'}
          </p>
          <p className="text-[10px] text-slate-500 font-mono">
            {row.clientes?.cpf || row.clientes?.codigo_cliente || '—'}
          </p>
        </div>
      )
    },
    {
      key: 'valor_solicitado',
      header: 'Valor Solicitado',
      align: 'right',
      width: '130px',
      sortable: true,
      render: (row) => (
        <span className="font-mono font-bold text-slate-900 text-xs">
          {formatCurrency(row.valor_solicitado || row.valor_aprovado)}
        </span>
      )
    },
    {
      key: 'parcelas',
      header: 'Parcelas',
      align: 'center',
      width: '100px',
      render: (row) => (
        <span className="font-mono text-xs text-slate-700">
          {row.prazo_meses || row.numero_parcelas || '—'}x
        </span>
      )
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      width: '130px',
      sortable: true,
      render: (row) => <StatusBadge status={row.status} size="xs" />
    },
    {
      key: 'acoes',
      header: 'Ações Rápidas',
      align: 'right',
      width: '160px',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          {['analise', 'solicitado', 'pendente'].includes(row.status) && (
            <button
              onClick={() => {
                setSelectedEmprestimo(row);
                setProposalData({
                  valorAprovado: maskCurrency((row.valor_solicitado || 1000).toString()),
                  taxaJuros: '3.5',
                  prazoMeses: (row.prazo_meses || 12).toString(),
                  taxaServico: '50',
                  mensagem: 'Proposta de microcrédito formalizada.',
                  validadeDias: 7
                });
                setIsProposalDrawerOpen(true);
              }}
              title="Montar Proposta de Empréstimo"
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold rounded bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-colors"
            >
              <Send className="h-3 w-3" />
              <span>Proposta</span>
            </button>
          )}

          <button
            onClick={() => {
              setSelectedEmprestimo(row);
              setIsEmprestimoDrawerOpen(true);
            }}
            title="Inspecionar Contrato"
            className="p-1.5 rounded text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
        </div>
      )
    }
  ];

  // ── Grid Columns: Crédito da Loja ──────────────────────────────────────
  const creditoColumns: GridColumn<any>[] = [
    {
      key: 'id',
      header: 'Solicitação',
      width: '130px',
      render: (row) => (
        <span className="font-mono font-bold text-slate-900 text-xs">
          #{row.id.slice(0, 8)}
        </span>
      )
    },
    {
      key: 'cliente',
      header: 'Cliente Solicitante',
      render: (row) => (
        <div>
          <p className="font-semibold text-slate-900 text-xs truncate">
            {row.clientes?.nome || 'Cliente não identificado'}
          </p>
          <p className="text-[10px] text-slate-500 font-mono">
            {row.clientes?.cpf || row.clientes?.cnpj || '—'}
          </p>
        </div>
      )
    },
    {
      key: 'limite_solicitado',
      header: 'Limite Solicitado',
      align: 'right',
      width: '140px',
      sortable: true,
      render: (row) => (
        <span className="font-mono font-bold text-slate-900 text-xs">
          {formatCurrency(row.limite_solicitado || row.limite_aprovado)}
        </span>
      )
    },
    {
      key: 'status',
      header: 'Status Análise',
      align: 'center',
      width: '140px',
      sortable: true,
      render: (row) => <StatusBadge status={row.status} size="xs" />
    },
    {
      key: 'acoes',
      header: 'Ações Rápidas',
      align: 'right',
      width: '160px',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          {['analise', 'documentos_pendentes'].includes(row.status) && (
            <>
              <button
                onClick={() => {
                  setSelectedCredito(row);
                  setCreditLimitAprovado(maskCurrency((row.limite_solicitado || 1000).toString()));
                  setIsPreApproveDrawerOpen(true);
                }}
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold rounded bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-colors"
              >
                <CheckCircle2 className="h-3 w-3" />
                <span>{row.origem_pre_aprovado ? 'Aprovar R$ 100' : 'Pré-Aprovar'}</span>
              </button>
              <button
                onClick={() => handleRecusarCredito(row)}
                className="p-1 rounded text-rose-600 hover:bg-rose-50"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </>
          )}

          <button
            onClick={() => {
              setSelectedCredito(row);
              setIsCreditoDrawerOpen(true);
            }}
            className="p-1.5 rounded text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-4 animate-fade-up">
      {/* ── Sub-Navigation Tabs ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center bg-slate-200/70 p-1 rounded-xl border border-slate-200 gap-1">
          <button
            onClick={() => setActiveTab('emprestimos')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'emprestimos'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Landmark className="h-3.5 w-3.5 text-indigo-600" />
            <span>Mesa de Empréstimos & Financiamentos</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-indigo-100 text-indigo-800">
              {emprestimos.filter(e => ['solicitado', 'analise', 'pendente'].includes(e.status)).length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('credito')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'credito'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span>Crédito da Loja & Limites</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800">
              {creditoSolicitacoes.filter(c => ['analise', 'documentos_pendentes'].includes(c.status)).length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('contestacoes')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'contestacoes' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Gavel className="h-3.5 w-3.5 text-amber-600" />
            <span>Contestações</span>
          </button>

          <button
            onClick={() => setActiveTab('saques_credito')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'saques_credito' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <DollarSign className="h-3.5 w-3.5 text-indigo-600" />
            <span>Saques de Crédito</span>
          </button>

          <button
            onClick={() => setActiveTab('cancelamentos_limite')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'cancelamentos_limite' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <XCircle className="h-3.5 w-3.5 text-rose-600" />
            <span>Cancelar Limites</span>
          </button>
        </div>

        <button
          onClick={() => {
            fetchEmprestimos();
            fetchCredito();
          }}
          title="Recarregar Dados"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Atualizar</span>
        </button>
      </div>

      {/* ── Active Grid ── */}
      {activeTab === 'saques_credito' ? (
        <CreditWithdrawalsAdminPanel initialItemId={initialItemId} />
      ) : activeTab === 'cancelamentos_limite' ? (
        <CreditLimitCancellationsAdminPanel initialItemId={initialItemId} />
      ) : activeTab === 'contestacoes' ? (
        <CreditDisputesAdminPanel initialItemId={initialItemId} />
      ) : activeTab === 'emprestimos' ? (
        <TacticalDataGrid
          title="Esteira de Microcrédito & Empréstimos"
          subtitle="Análise de score de risco, elaboração de propostas e despacho de contratos."
          data={emprestimos}
          columns={emprestimoColumns}
          keyExtractor={(row) => row.id}
          isLoading={loadingEmprestimos}
          onRowClick={(row) => {
            setSelectedEmprestimo(row);
            setIsEmprestimoDrawerOpen(true);
          }}
        />
      ) : (
        <TacticalDataGrid
          title="Subscrição de Limites de Crédito Loja"
          subtitle="Avaliação cadastral de pessoa física e jurídica para liberação de compras a prazo."
          data={creditoSolicitacoes}
          columns={creditoColumns}
          keyExtractor={(row) => row.id}
          isLoading={loadingCredito}
          onRowClick={(row) => {
            setSelectedCredito(row);
            setIsCreditoDrawerOpen(true);
          }}
        />
      )}

      {/* ══════════════════════════════════════════════════════════
          SLIDE-OVER 1: EMPRÉSTIMO INSPECTION
          ══════════════════════════════════════════════════════════ */}
      <CommandSlideOver
        isOpen={isEmprestimoDrawerOpen}
        onClose={() => setIsEmprestimoDrawerOpen(false)}
        title={selectedEmprestimo ? `Contrato de Empréstimo #${selectedEmprestimo.id.slice(0, 8)}` : 'Detalhes'}
        subtitle={selectedEmprestimo ? `Cliente: ${selectedEmprestimo.clientes?.nome}` : ''}
        badge={selectedEmprestimo ? <StatusBadge status={selectedEmprestimo.status} size="sm" /> : undefined}
        width="lg"
        footer={
          selectedEmprestimo && (
            <div className="flex items-center justify-between w-full flex-wrap gap-2">
              <div className="flex items-center gap-2">
                {selectedEmprestimo.status === 'ativo' && (
                  <button
                    type="button"
                    onClick={() => {
                      setPayoffValor(maskCurrency((selectedEmprestimo.valor_aprovado * 0.85).toString()));
                      setIsPayoffDrawerOpen(true);
                    }}
                    className="px-3 py-2 text-xs font-bold rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100 transition-colors"
                  >
                    Oferta de Quitação Antecipada
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {['solicitado', 'analise', 'pendente'].includes(selectedEmprestimo.status) && (
                  <button
                    type="button"
                    onClick={() => {
                      setProposalData({
                        valorAprovado: maskCurrency((selectedEmprestimo.valor_solicitado || 1000).toString()),
                        taxaJuros: '3.5',
                        prazoMeses: (selectedEmprestimo.prazo_meses || 12).toString(),
                        taxaServico: '50',
                        mensagem: 'Proposta formalizada pela mesa de crédito.',
                        validadeDias: 7
                      });
                      setIsProposalDrawerOpen(true);
                    }}
                    className="px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-2xs"
                  >
                    Montar Proposta de Crédito
                  </button>
                )}
              </div>
            </div>
          )
        }
      >
        {selectedEmprestimo && (
          <div className="space-y-6 text-xs">
            {/* Financial Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Valor Solicitado</span>
                <p className="text-base font-mono font-bold text-slate-900 mt-0.5">
                  {formatCurrency(selectedEmprestimo.valor_solicitado)}
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">Valor Aprovado</span>
                <p className="text-base font-mono font-bold text-indigo-950 mt-0.5">
                  {formatCurrency(selectedEmprestimo.valor_aprovado || selectedEmprestimo.valor_solicitado)}
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Prazo / Parcelas</span>
                <p className="text-sm font-mono font-bold text-slate-900 mt-0.5">
                  {selectedEmprestimo.prazo_meses || 12}x de ~{formatCurrency((selectedEmprestimo.valor_aprovado || selectedEmprestimo.valor_solicitado) / (selectedEmprestimo.prazo_meses || 12))}
                </p>
              </div>
            </div>

            {/* Installments Table */}
            {selectedEmprestimo.emprestimo_parcelas && selectedEmprestimo.emprestimo_parcelas.length > 0 && (
              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-3">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Cronograma de Amortização</h4>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden font-mono">
                  {selectedEmprestimo.emprestimo_parcelas.map((p: any) => (
                    <div key={p.id} className="p-2.5 flex items-center justify-between bg-slate-50/50">
                      <span>Parcela {p.numero_parcela} ({formatDate(p.data_vencimento)})</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{formatCurrency(p.valor)}</span>
                        <StatusBadge status={p.status} size="xs" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CommandSlideOver>

      {/* ══════════════════════════════════════════════════════════
          SLIDE-OVER 2: PROPOSAL BUILDER
          ══════════════════════════════════════════════════════════ */}
      <CommandSlideOver
        isOpen={isProposalDrawerOpen}
        onClose={() => setIsProposalDrawerOpen(false)}
        title="Enviar Proposta Formal de Empréstimo"
        subtitle={selectedEmprestimo ? `Proponente: ${selectedEmprestimo.clientes?.nome}` : ''}
        width="md"
        primaryAction={{
          label: 'Enviar Proposta ao Cliente',
          onClick: handleEnviarProposta,
          loading: submittingProposal,
          variant: 'primary',
          icon: <Send className="h-4 w-4" />
        }}
        secondaryAction={{
          label: 'Cancelar',
          onClick: () => setIsProposalDrawerOpen(false)
        }}
      >
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Valor Aprovado (R$) *
              </label>
              <input
                type="text"
                value={proposalData.valorAprovado}
                onChange={(e) => setProposalData(prev => ({ ...prev, valorAprovado: maskCurrency(e.target.value) }))}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono font-bold text-slate-900 shadow-2xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Taxa de Juros Mensal (%) *
              </label>
              <input 
                type="number"
                step="0.1"
                value={proposalData.taxaJuros}
                inputMode="numeric"
onChange={(e) => setProposalData(prev => ({ ...prev, taxaJuros: e.target.value }))}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono font-bold text-slate-900 shadow-2xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Prazo em Meses *
              </label>
              <input 
                type="number"
                value={proposalData.prazoMeses}
                inputMode="numeric"
onChange={(e) => setProposalData(prev => ({ ...prev, prazoMeses: e.target.value }))}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono font-bold text-slate-900 shadow-2xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Taxa de Abertura / TAC (R$)
              </label>
              <input 
                type="number"
                value={proposalData.taxaServico}
                inputMode="numeric"
onChange={(e) => setProposalData(prev => ({ ...prev, taxaServico: e.target.value }))}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono font-bold text-slate-900 shadow-2xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Mensagem Formal da Proposta
            </label>
            <textarea
              rows={3}
              value={proposalData.mensagem}
              onChange={(e) => setProposalData(prev => ({ ...prev, mensagem: e.target.value }))}
              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 shadow-2xs"
            />
          </div>
        </div>
      </CommandSlideOver>

      {/* ══════════════════════════════════════════════════════════
          SLIDE-OVER 3: PAYOFF OFFER DRAWER
          ══════════════════════════════════════════════════════════ */}
      <CommandSlideOver
        isOpen={isPayoffDrawerOpen}
        onClose={() => setIsPayoffDrawerOpen(false)}
        title="Oferta de Quitação com Desconto"
        width="sm"
        primaryAction={{
          label: 'Enviar Oferta',
          onClick: handleEnviarOfertaQuitacao,
          loading: submittingPayoff,
          variant: 'primary'
        }}
        secondaryAction={{
          label: 'Cancelar',
          onClick: () => setIsPayoffDrawerOpen(false)
        }}
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900">
            Envie uma proposta de quitação com desconto sobre os juros vincendos para antecipação de saldo devedor.
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Valor Promocional para Quitação (R$) *
            </label>
            <input
              type="text"
              value={payoffValor}
              onChange={(e) => setPayoffValor(maskCurrency(e.target.value))}
              className="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono font-bold text-slate-900 shadow-2xs"
            />
          </div>
        </div>
      </CommandSlideOver>

      {/* ══════════════════════════════════════════════════════════
          SLIDE-OVER 4: PRE-APPROVE CREDIT
          ══════════════════════════════════════════════════════════ */}
      <CommandSlideOver
        isOpen={isPreApproveDrawerOpen}
        onClose={() => setIsPreApproveDrawerOpen(false)}
        title={selectedCredito?.origem_pre_aprovado ? 'Aprovar Liberação de R$ 100,00' : 'Pré-Aprovar Limite de Crédito Loja'}
        subtitle={selectedCredito ? `Cliente: ${selectedCredito.clientes?.nome}` : ''}
        width="sm"
        primaryAction={{
          label: selectedCredito?.origem_pre_aprovado ? 'Aprovar e Liberar R$ 100,00' : 'Confirmar Pré-Aprovação',
          onClick: handlePreAprovarCredito,
          loading: submittingPreApprove,
          variant: 'success'
        }}
        secondaryAction={{
          label: 'Cancelar',
          onClick: () => setIsPreApproveDrawerOpen(false)
        }}
      >
        <div className="space-y-4 text-xs">
          {selectedCredito?.origem_pre_aprovado ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
              O cliente solicitou a oferta universal de limite total de R$ 100,00. Ao aprovar, o limite será elevado até R$ 100,00, preservando o valor já utilizado.
              <p className="mt-2 font-bold">Prazo da análise: {selectedCredito.prazo_analise ? formatDateTime(selectedCredito.prazo_analise) : '72 horas'}</p>
            </div>
          ) : <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Limite Aprovado (R$) *
            </label>
            <input
              type="text"
              value={creditLimitAprovado}
              onChange={(e) => setCreditLimitAprovado(maskCurrency(e.target.value))}
              className="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono font-bold text-slate-900 shadow-2xs"
            />
          </div>}
        </div>
      </CommandSlideOver>

      {/* ══════════════════════════════════════════════════════════
          SLIDE-OVER 5: CRÉDITO INSPECTION
          ══════════════════════════════════════════════════════════ */}
      <CommandSlideOver
        isOpen={isCreditoDrawerOpen}
        onClose={() => setIsCreditoDrawerOpen(false)}
        title={selectedCredito ? `Solicitação de Crédito #${selectedCredito.id.slice(0, 8)}` : 'Detalhes'}
        subtitle={selectedCredito ? `Cliente: ${selectedCredito.clientes?.nome}` : ''}
        badge={selectedCredito ? <StatusBadge status={selectedCredito.status} size="sm" /> : undefined}
        width="md"
      >
        {selectedCredito && (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-slate-500">Limite Solicitado</span>
              <p className="text-xl font-mono font-bold text-slate-900">{formatCurrency(selectedCredito.limite_solicitado)}</p>
            </div>
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2">
              <h4 className="text-xs font-bold text-slate-900 uppercase">Dados do Cliente</h4>
              <p className="font-bold">{selectedCredito.clientes?.nome}</p>
              <p className="text-slate-500 font-mono">{selectedCredito.clientes?.cpf || selectedCredito.clientes?.cnpj}</p>
              <p className="text-slate-500">{selectedCredito.clientes?.telefone || selectedCredito.clientes?.email}</p>
            </div>
          </div>
        )}
      </CommandSlideOver>
    </div>
  );
}
