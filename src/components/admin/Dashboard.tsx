import { useCallback, useEffect, useMemo, useState } from 'react';
import type React from 'react';
import {
  AlertCircle,
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
      className="group rounded-[1.75rem] bg-white p-6 text-left shadow-sm ring-1 ring-neutral-100 transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
          <Icon className="h-6 w-6" />
        </span>
        <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-neutral-500">
          {caption}
        </span>
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">{label}</p>
      <p className="mt-1 text-2xl font-black tabular-nums text-neutral-900">{value}</p>
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
    <section className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-neutral-100 sm:p-7">
      <header className="mb-5 flex items-center justify-between gap-3 border-b border-neutral-100 pb-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700">
            <Icon className="h-5 w-5" />
          </span>
          <h3 className="font-black text-neutral-900">{title}</h3>
        </div>
        {onOpen && (
          <button type="button" onClick={onOpen} className="text-xs font-black uppercase tracking-wider text-indigo-600 hover:text-indigo-800">
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
    <div className="flex flex-col gap-3 rounded-2xl border border-neutral-100 p-4 sm:flex-row sm:items-center sm:justify-between">
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

  return (
    <div className="space-y-8 pb-12">
      <header className="relative overflow-hidden rounded-[2.5rem] bg-[#0F0F0F] p-8 text-white shadow-xl md:p-10">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-white/40">Painel administrativo seguro</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">
              Olá, {adminType === 'admin' ? 'Administrador' : colaboradorNome || 'Colaborador'}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-white/55">
              Os indicadores abaixo são calculados no servidor e limitados aos módulos autorizados para sua sessão.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={refreshing}
            className="flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-black text-neutral-900 transition hover:bg-neutral-100 disabled:opacity-60"
          >
            <RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Atualizar
          </button>
        </div>
      </header>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {cards.map((card) => <KpiCard key={card.label} {...card} />)}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {snapshot.permissions.financeiro && (
          <ListCard title="Faturas que exigem atenção" icon={Landmark} onOpen={() => onNavigate?.('financeiro', 'faturas')}>
            <div className="space-y-3">
              {(snapshot.lists.faturas || []).length === 0 ? <EmptyState text="Nenhuma fatura pendente." /> : (snapshot.lists.faturas || []).map((invoice) => (
                <Row
                  key={invoice.id}
                  title={invoice.cliente_nome || invoice.codigo_fatura || 'Fatura'}
                  subtitle={`${invoice.codigo_fatura || 'Sem código'} · vencimento ${formatDate(invoice.data_vencimento)}`}
                  value={formatCurrency(invoice.valor_final_pendente ?? invoice.valor_total)}
                  action={
                    <button
                      type="button"
                      onClick={() => void markInvoicePaid(invoice)}
                      disabled={processingId === invoice.id}
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
                    >
                      {processingId === invoice.id ? 'Processando' : 'Dar baixa'}
                    </button>
                  }
                />
              ))}
            </div>
          </ListCard>
        )}

        {snapshot.permissions.financeiro && (
          <ListCard title="Saques pendentes" icon={Wallet} onOpen={() => onNavigate?.('financeiro', 'saques')}>
            <div className="space-y-3">
              {(snapshot.lists.saques || []).length === 0 ? <EmptyState text="Nenhum saque pendente." /> : (snapshot.lists.saques || []).map((withdrawal) => (
                <Row
                  key={withdrawal.id}
                  title={withdrawal.cliente_nome || 'Cliente'}
                  subtitle={`Solicitado em ${formatDate(withdrawal.data_solicitacao)}`}
                  value={formatCurrency(withdrawal.valor)}
                  action={
                    <button
                      type="button"
                      onClick={() => void approveWithdrawal(withdrawal)}
                      disabled={processingId === withdrawal.id}
                      className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
                    >
                      {processingId === withdrawal.id ? 'Processando' : 'Aprovar'}
                    </button>
                  }
                />
              ))}
            </div>
          </ListCard>
        )}

        {snapshot.permissions.operacoes && (
          <ListCard title="Orçamentos recentes" icon={Clock} onOpen={() => onNavigate?.('operacoes', 'orcamentos')}>
            <div className="space-y-3">
              {(snapshot.lists.orcamentos || []).length === 0 ? <EmptyState text="Nenhum orçamento pendente." /> : (snapshot.lists.orcamentos || []).map((quote) => (
                <Row
                  key={quote.id}
                  title={quote.cliente_nome || quote.codigo_orcamento || 'Orçamento'}
                  subtitle={`${quote.codigo_orcamento || 'Sem código'} · ${formatDate(quote.data_criacao)}`}
                  value={String(quote.status || '').replace(/_/g, ' ')}
                />
              ))}
            </div>
          </ListCard>
        )}

        {snapshot.permissions.atendimento && (
          <ListCard title="Tickets abertos" icon={MessageSquare} onOpen={() => onNavigate?.('atendimento')}>
            <div className="space-y-3">
              {(snapshot.lists.tickets || []).length === 0 ? <EmptyState text="Nenhum ticket aberto." /> : (snapshot.lists.tickets || []).map((ticket) => (
                <Row
                  key={ticket.id}
                  title={ticket.titulo || ticket.cliente_nome || 'Ticket'}
                  subtitle={`${ticket.cliente_nome || 'Cliente'} · ${formatDate(ticket.data_abertura)}`}
                  value={String(ticket.status || '').replace(/_/g, ' ')}
                />
              ))}
            </div>
          </ListCard>
        )}
      </div>

      {cards.length === 0 && (
        <section className="rounded-[2rem] bg-white p-10 text-center shadow-sm ring-1 ring-neutral-100">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
          <h2 className="mt-4 text-xl font-black text-neutral-900">Acesso administrativo ativo</h2>
          <p className="mt-2 text-sm text-neutral-500">Use o menu lateral para acessar os módulos liberados para sua conta.</p>
        </section>
      )}

      {adminType === 'admin' && (
        <button
          type="button"
          onClick={() => onNavigate?.('acessos')}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-neutral-300 bg-white px-5 py-4 text-sm font-black text-neutral-600 hover:border-indigo-300 hover:text-indigo-700"
        >
          <UserPlus className="h-5 w-5" /> Gerenciar colaboradores e permissões
        </button>
      )}
    </div>
  );
}
