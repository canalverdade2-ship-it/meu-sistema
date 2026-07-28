import { useCallback, useEffect, useMemo, useState } from 'react';
import type React from 'react';
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  CheckCircle2,
  Clock,
  FileText,
  Landmark,
  MessageSquare,
  RefreshCcw,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { callAdminRpc } from '../../lib/adminRpc';
import { formatCurrency, formatDate } from '../../lib/utils';
import { useAdminNotifications } from '../../hooks/useAdminNotifications';

interface DashboardProps {
  onNavigate?: (module: string, tab?: string) => void;
  adminType?: 'admin' | 'colaborador';
  colaboradorId?: string;
  colaboradorNome?: string;
  colaboradorModulos?: string[];
}

interface DashboardSnapshot {
  permissions: Record<string, boolean>;
  stats: {
    faturamento_seis_meses: number;
    faturamento_mes_atual: number;
    faturamento_mes_anterior: number;
    clientes_total: number;
    promocoes_ativas: number;
    credito_pendente_total: number;
  };
  lists: {
    faturas?: any[];
    saques?: any[];
    emprestimos?: any[];
    cobrancas?: any[];
    orcamentos?: any[];
    tickets?: any[];
  };
}

const emptySnapshot: DashboardSnapshot = {
  permissions: {},
  stats: {
    faturamento_seis_meses: 0,
    faturamento_mes_atual: 0,
    faturamento_mes_anterior: 0,
    clientes_total: 0,
    promocoes_ativas: 0,
    credito_pendente_total: 0,
  },
  lists: {},
};

function KpiCard({
  label,
  value,
  icon: Icon,
  caption,
  onClick,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  caption: string;
  onClick?: () => void;
  key?: React.Key;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group bg-white p-5 text-left transition hover:bg-[#faf8f2] sm:p-6"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#ddd6c8] bg-[#f8f5ee] text-[#806329]">
          <Icon className="h-6 w-6" />
        </span>
        <span className="border-l border-[#ddd6c8] pl-3 text-[9px] font-black uppercase tracking-[0.12em] text-[#737a80]">
          {caption}
        </span>
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#737a80]">{label}</p>
      <p className="mt-2 text-2xl font-black tabular-nums tracking-[-0.035em] text-[#111b24]">{value}</p>
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="py-8 text-center text-sm text-neutral-400">{text}</p>;
}

function ListCard({
  title,
  icon: Icon,
  children,
  onOpen,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  onOpen?: () => void;
}) {
  return (
    <section className="border border-[#d9ddd9] bg-white p-5 sm:p-7">
      <header className="mb-5 flex items-center justify-between gap-3 border-b border-[#dde1dd] pb-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#d9ddd9] bg-[#f6f7f5] text-[#526069]">
            <Icon className="h-5 w-5" />
          </span>
          <h3 className="font-black text-neutral-900">{title}</h3>
        </div>
        {onOpen && (
          <button type="button" onClick={onOpen} className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#806329] hover:text-[#5e471c]">
            Abrir módulo
          </button>
        )}
      </header>
      {children}
    </section>
  );
}

function Row({
  title,
  subtitle,
  value,
  action,
}: {
  title: string;
  subtitle?: string;
  value?: string;
  action?: React.ReactNode;
  key?: React.Key;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-[#e2e5e2] py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate text-sm font-black text-neutral-900">{title}</p>
        {subtitle && <p className="mt-1 text-xs text-neutral-500">{subtitle}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {value && <span className="text-sm font-black text-neutral-800">{value}</span>}
        {action}
      </div>
    </div>
  );
}

export function Dashboard({
  onNavigate,
  adminType = 'admin',
  colaboradorNome,
}: DashboardProps) {
  const { pendencies, refreshCounts } = useAdminNotifications();
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(emptySnapshot);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await callAdminRpc<DashboardSnapshot>('gsa_admin_dashboard_snapshot');
      setSnapshot({
        permissions: data?.permissions || {},
        stats: { ...emptySnapshot.stats, ...(data?.stats || {}) },
        lists: data?.lists || {},
      });
    } catch (error: any) {
      console.error('Erro ao carregar dashboard administrativo:', error);
      toast.error(error?.message || 'Não foi possível carregar o dashboard.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load(true);
    }, 60_000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void load(true);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [load]);

  const trend = useMemo(() => {
    const current = Number(snapshot.stats.faturamento_mes_atual || 0);
    const previous = Number(snapshot.stats.faturamento_mes_anterior || 0);
    if (previous <= 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }, [snapshot.stats.faturamento_mes_anterior, snapshot.stats.faturamento_mes_atual]);

  const refresh = async () => {
    await Promise.all([load(true), refreshCounts()]);
  };

  const markInvoicePaid = async (invoice: any) => {
    if (!invoice?.id) return;
    setProcessingId(invoice.id);
    try {
      const result = await callAdminRpc<any>('gsa_admin_baixar_fatura', {
        p_fatura_id: invoice.id,
        p_metodo: 'manual_dashboard',
        p_data_pagamento: new Date().toISOString(),
        p_observacoes: 'Baixa rápida realizada pelo dashboard administrativo seguro.',
      });
      if (result && result.success === false) throw new Error(result.error || 'Não foi possível baixar a fatura.');
      toast.success('Fatura marcada como paga.');
      await refresh();
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao baixar a fatura.');
    } finally {
      setProcessingId(null);
    }
  };

  const approveWithdrawal = async (withdrawal: any) => {
    if (!withdrawal?.id) return;
    setProcessingId(withdrawal.id);
    try {
      const result = await callAdminRpc<any>('gsa_admin_processar_saque', {
        p_saque_id: withdrawal.id,
        p_acao: 'aprovar',
        p_motivo: null,
        p_data_pagamento: new Date().toISOString().split('T')[0],
      });
      if (result && result.success === false) throw new Error(result.error || 'Não foi possível aprovar o saque.');
      toast.success('Saque aprovado.');
      await refresh();
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao aprovar o saque.');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 pb-12">
        <div className="h-32 animate-pulse rounded-[2.5rem] bg-neutral-900" />
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => <div key={item} className="h-40 animate-pulse rounded-[1.75rem] bg-white" />)}
        </div>
      </div>
    );
  }

  const cards = [
    snapshot.permissions.financeiro && {
      label: 'Faturamento dos últimos 6 meses',
      value: formatCurrency(snapshot.stats.faturamento_seis_meses),
      icon: TrendingUp,
      caption: `${trend >= 0 ? '+' : ''}${trend.toFixed(1)}% no mês`,
      onClick: () => onNavigate?.('financeiro', 'dashboard'),
    },
    snapshot.permissions.financeiro && {
      label: 'Faturas pendentes',
      value: String(pendencies.financeiro_faturas_pendentes + pendencies.financeiro_faturas_vencidas),
      icon: AlertCircle,
      caption: 'Atenção',
      onClick: () => onNavigate?.('financeiro', 'faturas'),
    },
    snapshot.permissions.financeiro && {
      label: 'Crédito solicitado',
      value: formatCurrency(snapshot.stats.credito_pendente_total),
      icon: Banknote,
      caption: 'Total completo',
      onClick: () => onNavigate?.('financeiro', 'emprestimos'),
    },
    snapshot.permissions.cadastro && {
      label: 'Clientes cadastrados',
      value: Number(snapshot.stats.clientes_total || 0).toLocaleString('pt-BR'),
      icon: Users,
      caption: 'Cadastros',
      onClick: () => onNavigate?.('cadastro', 'clientes'),
    },
    snapshot.permissions.operacoes && {
      label: 'Orçamentos pendentes',
      value: String(pendencies.vendas_orcamentos_pendentes),
      icon: FileText,
      caption: 'Operações',
      onClick: () => onNavigate?.('operacoes', 'orcamentos'),
    },
    snapshot.permissions.atendimento && {
      label: 'Tickets abertos',
      value: String(pendencies.suporte_tickets_abertos),
      icon: MessageSquare,
      caption: 'Atendimento',
      onClick: () => onNavigate?.('atendimento'),
    },
  ].filter(Boolean) as Array<{
    label: string;
    value: string;
    icon: React.ElementType;
    caption: string;
    onClick: () => void;
  }>;

  const criticalCount = Number(pendencies.financeiro_faturas_pendentes || 0)
    + Number(pendencies.financeiro_faturas_vencidas || 0)
    + Number(pendencies.vendas_orcamentos_pendentes || 0)
    + Number(pendencies.suporte_tickets_abertos || 0);

  return (
    <div className="space-y-7 pb-12 text-[#111b24]">
      <header className="relative overflow-hidden border border-[#2a343c] bg-[#101820] p-7 text-white shadow-[0_24px_70px_rgba(16,24,32,0.18)] md:p-10">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full border border-[#d8bd73]/12" />
        <div className="relative grid gap-8 lg:grid-cols-[1fr_330px] lg:items-end">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#d8bd73]">Central de comando operacional</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.02] tracking-[-0.045em] sm:text-5xl">Decisões, filas críticas e dinheiro em risco no mesmo painel.</h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-white/55">Olá, {adminType === 'admin' ? 'Administrador' : colaboradorNome || 'Colaborador'}. Os dados são calculados no servidor e respeitam as permissões da sua sessão.</p>
          </div>
          <div className="border-l border-white/12 pl-6">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">Ocorrências abertas</p>
            <div className="mt-3 flex items-end justify-between gap-4"><strong className="text-5xl font-black tracking-[-0.06em] text-[#d8bd73]">{criticalCount}</strong><button type="button" onClick={() => void refresh()} disabled={refreshing} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/15 bg-white/[0.05] px-4 text-xs font-black text-white disabled:opacity-60"><RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />Atualizar</button></div>
            <p className="mt-3 text-xs leading-5 text-white/45">Faturas, orçamentos e tickets aguardando ação.</p>
          </div>
        </div>
      </header>

      {cards.length > 0 && (
        <section>
          <div className="flex flex-col gap-3 border-b border-[#d6dbd7] pb-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#806329]">Scorecard executivo</p><h2 className="mt-2 text-2xl font-black tracking-[-0.035em]">Indicadores que exigem leitura diária</h2></div><p className="text-xs text-[#697279]">Clique em um indicador para abrir o módulo responsável.</p></div>
          <div className="mt-5 grid overflow-hidden border border-[#d9ddd9] bg-[#d9ddd9] sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{cards.map((card) => <KpiCard key={card.label} {...card} />)}</div>
        </section>
      )}

      <section>
        <div className="flex flex-col gap-3 border-b border-[#d6dbd7] pb-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#806329]">Filas operacionais</p><h2 className="mt-2 text-2xl font-black tracking-[-0.035em]">O que precisa ser resolvido agora</h2></div><p className="max-w-md text-xs leading-5 text-[#697279]">Ações rápidas permanecem disponíveis, mas cada decisão continua registrada nos fluxos oficiais.</p></div>
        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          {snapshot.permissions.financeiro && (
            <ListCard title="Faturas que exigem atenção" icon={Landmark} onOpen={() => onNavigate?.('financeiro', 'faturas')}>
              <div>{(snapshot.lists.faturas || []).length === 0 ? <EmptyState text="Nenhuma fatura pendente." /> : (snapshot.lists.faturas || []).map((invoice) => <Row key={invoice.id} title={invoice.cliente_nome || invoice.codigo_fatura || 'Fatura'} subtitle={`${invoice.codigo_fatura || 'Sem código'} · vencimento ${formatDate(invoice.data_vencimento)}`} value={formatCurrency(invoice.valor_final_pendente ?? invoice.valor_total)} action={<button type="button" onClick={() => void markInvoicePaid(invoice)} disabled={processingId === invoice.id} className="rounded-lg bg-[#137a5d] px-3 py-2 text-xs font-black text-white disabled:opacity-50">{processingId === invoice.id ? 'Processando' : 'Dar baixa'}</button>} />)}</div>
            </ListCard>
          )}

          {snapshot.permissions.financeiro && (
            <ListCard title="Saques pendentes" icon={Wallet} onOpen={() => onNavigate?.('financeiro', 'saques')}>
              <div>{(snapshot.lists.saques || []).length === 0 ? <EmptyState text="Nenhum saque pendente." /> : (snapshot.lists.saques || []).map((withdrawal) => <Row key={withdrawal.id} title={withdrawal.cliente_nome || 'Cliente'} subtitle={`Solicitado em ${formatDate(withdrawal.data_solicitacao)}`} value={formatCurrency(withdrawal.valor)} action={<button type="button" onClick={() => void approveWithdrawal(withdrawal)} disabled={processingId === withdrawal.id} className="rounded-lg bg-[#1d4d72] px-3 py-2 text-xs font-black text-white disabled:opacity-50">{processingId === withdrawal.id ? 'Processando' : 'Aprovar'}</button>} />)}</div>
            </ListCard>
          )}

          {snapshot.permissions.operacoes && (
            <ListCard title="Orçamentos recentes" icon={Clock} onOpen={() => onNavigate?.('operacoes', 'orcamentos')}>
              <div>{(snapshot.lists.orcamentos || []).length === 0 ? <EmptyState text="Nenhum orçamento pendente." /> : (snapshot.lists.orcamentos || []).map((quote) => <Row key={quote.id} title={quote.cliente_nome || quote.codigo_orcamento || 'Orçamento'} subtitle={`${quote.codigo_orcamento || 'Sem código'} · ${formatDate(quote.data_criacao)}`} value={String(quote.status || '').replace(/_/g, ' ')} />)}</div>
            </ListCard>
          )}

          {snapshot.permissions.atendimento && (
            <ListCard title="Tickets abertos" icon={MessageSquare} onOpen={() => onNavigate?.('atendimento')}>
              <div>{(snapshot.lists.tickets || []).length === 0 ? <EmptyState text="Nenhum ticket aberto." /> : (snapshot.lists.tickets || []).map((ticket) => <Row key={ticket.id} title={ticket.titulo || ticket.cliente_nome || 'Ticket'} subtitle={`${ticket.cliente_nome || 'Cliente'} · ${formatDate(ticket.data_abertura)}`} value={String(ticket.status || '').replace(/_/g, ' ')} />)}</div>
            </ListCard>
          )}
        </div>
      </section>

      {cards.length === 0 && <section className="border border-[#d9ddd9] bg-white p-10 text-center"><CheckCircle2 className="mx-auto h-10 w-10 text-[#137a5d]" /><h2 className="mt-4 text-xl font-black">Acesso administrativo ativo</h2><p className="mt-2 text-sm text-[#697279]">Use o menu lateral para acessar os módulos liberados para sua conta.</p></section>}

      {adminType === 'admin' && <button type="button" onClick={() => onNavigate?.('acessos')} className="group flex w-full items-center justify-between border border-[#cfc7b7] bg-[#f8f5ee] px-6 py-5 text-left"><span className="flex items-center gap-4"><UserPlus className="h-5 w-5 text-[#806329]" /><span><strong className="block text-sm">Gestão de colaboradores e permissões</strong><span className="mt-1 block text-xs text-[#697279]">Controle acessos sem misturar esta fila com a operação diária.</span></span></span><ArrowRight className="h-4 w-4 text-[#806329] transition group-hover:translate-x-1" /></button>}
    </div>
  );
}
