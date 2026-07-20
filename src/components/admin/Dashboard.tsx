import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Users, 
  FileText, 
  ClipboardList, 
  TrendingUp, 
  AlertCircle, 
  ArrowUpRight,
  Clock, 
  CheckCircle2, 
  Wallet,
  UserPlus,
  BarChart3,
  MessageSquare,
  Sun, Moon, Coffee, Gavel,
  Landmark, Target, Banknote
} from 'lucide-react';
import { useAdminNotifications } from '../../hooks/useAdminNotifications';
import { supabase } from '../../lib/supabase';
import { formatCurrency, formatDate, formatDateTime } from '../../lib/utils';
import { createNotification } from '../../lib/notifications';

import { toast } from 'react-hot-toast';
import { logService } from '../../lib/logService';
import { sessionService } from '../../lib/sessionService';

/* ── Hook: animação de contagem ──────────────────────── */
function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      // Easing quadrático
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      setValue(Math.round(eased * target));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  return value;
}

/* ── Saudação dinâmica ───────────────────────────────── */
function getDynamicGreeting() {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return { text: 'Bom dia',   Icon: Sun,    color: 'text-amber-500'  };
  if (h >= 12 && h < 18) return { text: 'Boa tarde', Icon: Coffee, color: 'text-orange-500' };
  return                         { text: 'Boa noite', Icon: Moon,   color: 'text-indigo-400' };
}

/* ── Skeleton Card ───────────────────────────────────── */
function SkeletonKpiCard() {
  return (
    <div className="rounded-[1.75rem] bg-white p-6 ring-1 ring-neutral-100 shadow-sm">
      <div className="mb-4 flex items-start justify-between">
        <div className="skeleton h-12 w-12 rounded-2xl" />
        <div className="skeleton h-5 w-16 rounded-full" />
      </div>
      <div className="skeleton h-4 w-24 rounded mb-2" />
      <div className="skeleton h-8 w-32 rounded" />
    </div>
  );
}

function SkeletonListCard() {
  return (
    <div className="rounded-[2rem] bg-white p-8 ring-1 ring-neutral-100 shadow-sm">
      <div className="flex items-center justify-between mb-8 border-b border-neutral-100 pb-4">
        <div className="skeleton h-6 w-40 rounded" />
        <div className="skeleton h-4 w-16 rounded" />
      </div>
      <div className="space-y-3">
        {[1,2,3].map(i => <div key={i} className="skeleton h-14 w-full rounded-2xl" />)}
      </div>
    </div>
  );
}

/* ── KPI Card com countUp ────────────────────────────── */
function KpiCard({
  label, rawValue, displayValue, icon: Icon, color, bg, trend, trendUp, badge, onClick, index
}: any) {
  const numericCount = useCountUp(typeof rawValue === 'number' ? rawValue : 0);
  const display = typeof rawValue === 'number' ? numericCount.toLocaleString('pt-BR') : displayValue;

  return (
    <div
      onClick={onClick}
      className="group relative rounded-[1.75rem] bg-white p-6 ring-1 ring-neutral-100 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1 cursor-pointer animate-fade-up"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Glow accent no hover */}
      <div className={`absolute inset-0 rounded-[1.75rem] opacity-0 group-hover:opacity-5 transition-opacity ${bg.replace('bg-', 'bg-')}`} />

      <div className="relative flex items-start justify-between mb-4">
        <div className={`relative flex h-13 w-13 items-center justify-center rounded-2xl ${bg} transition-transform group-hover:scale-110`}>
          <Icon className={`h-6 w-6 ${color}`} />
          {badge > 0 && (
            <span className="absolute -top-2 -right-2 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-black text-white ring-2 ring-white animate-pulse shadow-md">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </div>
        {trendUp !== undefined && (
          <div className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${trendUp ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
            {trendUp && <ArrowUpRight className="h-3 w-3" />}
            {trend}
          </div>
        )}
      </div>

      <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">{label}</p>
      <h3 className="text-2xl font-black text-neutral-900 tabular-nums">{display}</h3>
    </div>
  );
}

/* ── Timestamp relativo ──────────────────────────────── */
function relativeTime(dateStr: string) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

/* ═══════════════════════════════════════════════════════
   DASHBOARD PRINCIPAL
   ═══════════════════════════════════════════════════════ */
export function Dashboard({ onNavigate, adminType, colaboradorId, colaboradorNome, colaboradorModulos = [] }: { 
  onNavigate?: (module: string, tab?: string) => void,
  adminType?: 'admin' | 'colaborador',
  colaboradorId?: string,
  colaboradorNome?: string,
  colaboradorModulos?: string[]
}) {
  const { pendencies: globalPendencies } = useAdminNotifications();
  const [loading, setLoading] = useState(true);
  const greeting = getDynamicGreeting();

  const [stats, setStats] = useState({
    totalFaturado: 0,
    clientesTotal: 0,
    crescimentoMensal: 0,
    promocoesAtivas: 0,
    emprestimosValorPendente: 0,
  });

  const [pendencies, setPendencies] = useState<{
    faturas: any[]; saques: any[]; os: any[];
    indicacoes: any[]; tickets: any[]; orcamentos: any[];
    trocas: any[]; avaliacoes: any[];
    emprestimos: any[]; cobrancas: any[];
  }>({ faturas: [], saques: [], os: [], indicacoes: [], tickets: [], orcamentos: [], trocas: [], avaliacoes: [], emprestimos: [], cobrancas: [] });



  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedFetch = useCallback(() => {
    if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    fetchTimeoutRef.current = setTimeout(fetchData, 500);
  }, []);

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel('admin-dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public' }, debouncedFetch)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    };
  }, []);

  const fetchData = async () => {
    try {
      // Trigger lazy evaluation of expired quitacoes (fire and forget)
      Promise.resolve(supabase.rpc('process_expired_quitacoes')).catch(e => console.error('Background job error:', e));

      const { data: counts } = await supabase.rpc('get_admin_counts');

      const now = new Date();
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split('T')[0];
      const { data: faturas } = await supabase
        .from('faturas')
        .select('valor_total, status, data_pagamento, data_vencimento, cliente_id')
        .eq('status', 'pago')
        .gte('data_pagamento', sixMonthsAgo);

      const paidFaturas = faturas || [];
      const total = paidFaturas.reduce((acc, curr) => acc + (Number(curr.valor_total) || 0), 0);

      // Gráfico real: últimos 6 meses (valores de faturamento agrupados por mês para cálculo do trend)
      const monthTotals: Record<string, number> = {};
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthTotals[key] = 0;
      }
      paidFaturas.filter(f => f.data_pagamento).forEach(f => {
        const d = new Date(f.data_pagamento);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (key in monthTotals) monthTotals[key] += Number(f.valor_total) || 0;
      });
      const monthValues = Object.values(monthTotals);

      // Calcular trend real: mês atual vs mês anterior
      const currentMonthVal = monthValues[5] || 0;
      const prevMonthVal = monthValues[4] || 0;
      const trendReal = prevMonthVal > 0
        ? ((currentMonthVal - prevMonthVal) / prevMonthVal) * 100
        : (currentMonthVal > 0 ? 100 : 0);

      setStats({
        totalFaturado: total,
        clientesTotal: counts?.clientesTotal || 0,
        crescimentoMensal: trendReal,
        promocoesAtivas: 0, // será preenchido abaixo
        emprestimosValorPendente: 0, // será preenchido abaixo
      });

      // Listas de pendências
      const [
        { data: pendingFaturas },
        { data: pendingSaques },
        { data: pendingOS },
        { data: pendingOC },
        { data: pendingOA },
        { data: pendingTickets },
        { data: pendingOrcamentos },
        { data: pendingIndicacoes },
        { data: pendingTrocas },
        { data: pendingAvaliacoes },
        { data: pendingEmprestimos },
        { data: pendingCobrancas },
        { count: promoCount }
      ] = await Promise.all([
        supabase.from('faturas').select('*, clientes(nome)').in('status', ['pendente','vencida']).order('data_vencimento', { ascending: true }).limit(5),
        supabase.from('saques').select('*, clientes(nome)').eq('status', 'pendente').order('data_solicitacao', { ascending: true }).limit(5),
        supabase.from('ordens_servico').select('*, clientes(nome)').in('status', ['aberto','aguardando','andamento']).order('data_inicio', { ascending: true }).limit(5),
        supabase.from('ordens_compra').select('*, clientes(nome)').in('status', ['em_analise','pendente']).order('data_criacao', { ascending: true }).limit(5),
        supabase.from('ordens_assinatura').select('*, clientes(nome)').in('status', ['em_analise','pendente']).order('data_criacao', { ascending: true }).limit(5),
        supabase.from('tickets').select('*, clientes(nome)').eq('status', 'aberto').order('data_abertura', { ascending: true }).limit(5),
        supabase.from('orcamentos').select('*, clientes(nome)').in('status', ['aberto','negociação','em revisão']).neq('categoria', 'emprestimo').order('data_criacao', { ascending: true }).limit(5),
        supabase.from('indicacoes').select('*, indicador:clientes!indicador_id(nome)').eq('status', 'aberta').order('data_indicacao', { ascending: true }).limit(5),
        supabase.from('loja_solicitacoes').select('*, clientes(nome), orcamentos!orcamento_origem_id(codigo_orcamento)').in('status', ['pendente', 'em_analise']).order('created_at', { ascending: true }).limit(5),
        supabase.from('loja_avaliacoes').select('*, clientes(nome), produtos(nome)').order('created_at', { ascending: false }).limit(5),
        supabase.from('emprestimos').select('*, clientes(nome)').in('status', ['analise', 'pendente', 'aguardando_assinatura']).order('created_at', { ascending: true }).limit(5),
        supabase.from('cobrancas').select('*, clientes(nome)').in('status', ['pendente', 'em_cobranca', 'acordo_quebrado']).order('created_at', { ascending: true }).limit(5),
        supabase.from('cliente_promocoes').select('*', { count: 'exact', head: true }).eq('status', 'ativa')
      ]);

      const allOrders = [
        ...(pendingOS || []).map(o => ({ ...o, type: 'OS', code: o.codigo_os, _date: o.data_inicio })),
        ...(pendingOC || []).map(o => ({ ...o, type: 'OC', code: o.codigo_ordem, _date: o.data_criacao })),
        ...(pendingOA || []).map(o => ({ ...o, type: 'OA', code: o.codigo_ordem, _date: o.data_criacao })),
      ].sort((a, b) => new Date(b._date).getTime() - new Date(a._date).getTime()).slice(0, 8);

      setPendencies({
        faturas: pendingFaturas || [],
        saques: pendingSaques || [],
        os: allOrders,
        indicacoes: pendingIndicacoes || [],
        tickets: pendingTickets || [],
        orcamentos: pendingOrcamentos || [],
        trocas: pendingTrocas || [],
        avaliacoes: pendingAvaliacoes || [],
        emprestimos: pendingEmprestimos || [],
        cobrancas: pendingCobrancas || [],
      });
      
      setStats(prev => ({
        ...prev,
        promocoesAtivas: promoCount || 0,
        emprestimosValorPendente: (pendingEmprestimos || []).reduce((acc, curr) => acc + (Number(curr.valor_solicitado) || 0), 0)
      }));
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkInvoicePaid = async (id: string) => {
    try {
      const { data: fatura } = await supabase.from('faturas').select('*').eq('id', id).single();
      if (!fatura) throw new Error('Fatura não encontrada');

      const session = sessionService.getCurrentSession();
      if (!session?.sessaoId || !session?.sessionToken) {
        throw new Error('Sessão administrativa expirada. Faça login novamente.');
      }

      const amountToPay = fatura.valor_final_pendente ?? fatura.valor_total;
      const { data: baixaResult, error: baixaError } = await supabase.rpc('gsa_admin_baixar_fatura', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_fatura_id: id,
        p_metodo: 'manual_dashboard',
        p_data_pagamento: new Date().toISOString(),
        p_observacoes: 'Baixa rápida realizada pelo dashboard administrativo.'
      });
      if (baixaError) throw baixaError;
      if (baixaResult && !(baixaResult as any).success) {
        throw new Error((baixaResult as any).error || 'Erro ao baixar fatura.');
      }

      await logService.logAction({
        ator_tipo: 'admin',
        acao: 'BAIXA_RAPIDA_FATURA_DASHBOARD',
        detalhes: `Fatura ${fatura.codigo_fatura} baixada manualmente via dashboard. Valor: ${formatCurrency(amountToPay)}`
      });
      toast.success('Fatura marcada como paga!');
      fetchData();
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao atualizar fatura.');
    }
  };

  const handleApproveSaque = async (id: string) => {
    try {
      const { data: saque } = await supabase.from('saques').select('*, clientes(nome)').eq('id', id).single();
      if (!saque) throw new Error('Saque não encontrado');

      const session = sessionService.getCurrentSession();
      if (!session?.sessaoId || !session?.sessionToken) {
        throw new Error('Sessão administrativa expirada. Faça login novamente.');
      }

      const { data, error } = await supabase.rpc('gsa_admin_processar_saque', {
        p_sessao_id: session.sessaoId,
        p_session_token: session.sessionToken,
        p_saque_id: id,
        p_acao: 'aprovar',
        p_motivo: null,
        p_data_pagamento: new Date().toISOString().split('T')[0]
      });
      if (error) throw error;
      if (data && !(data as any).success) throw new Error((data as any).error || 'Erro ao aprovar saque.');

      await createNotification(
        saque.cliente_id,
        'Saque aprovado',
        `Seu saque de ${formatCurrency(saque.valor)} foi aprovado e será processado em breve.`,
        'financeiro'
      );

      await logService.logAction({
        ator_tipo: 'admin',
        acao: 'APROVAR_SAQUE_DASHBOARD',
        detalhes: `Saque de ${(saque as any).clientes?.nome || saque.cliente_id} aprovado via dashboard. Valor: ${formatCurrency(saque.valor)}`
      });
      toast.success('Saque aprovado!');
      fetchData();
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao aprovar saque.');
    }
  };

  /* ── KPI Cards config ── */
  const cards = [
    {
      label: 'Total Faturado',
      rawValue: undefined,
      displayValue: formatCurrency(stats.totalFaturado),
      icon: TrendingUp,
      color: 'text-emerald-600', bg: 'bg-emerald-50',
      trend: stats.crescimentoMensal !== 0
        ? `${stats.crescimentoMensal > 0 ? '+' : ''}${stats.crescimentoMensal.toFixed(1)}%`
        : 'Este mês',
      trendUp: stats.crescimentoMensal >= 0,
      badge: 0,
      hidden: adminType === 'colaborador' && !colaboradorModulos.includes('financeiro'),
      onClick: () => onNavigate?.('financeiro', 'dashboard'),
    },
    {
      label: 'Faturas Pendentes',
      rawValue: globalPendencies.financeiro_faturas_vencidas + globalPendencies.financeiro_faturas_pendentes,
      displayValue: String(globalPendencies.financeiro_faturas_vencidas + globalPendencies.financeiro_faturas_pendentes),
      icon: AlertCircle,
      color: 'text-amber-600', bg: 'bg-amber-50',
      trend: 'Atenção', trendUp: false,
      badge: globalPendencies.financeiro_faturas_vencidas + globalPendencies.financeiro_faturas_pendentes,
      hidden: adminType === 'colaborador' && !colaboradorModulos.includes('financeiro'),
      onClick: () => onNavigate?.('financeiro', 'faturas'),
    },
    {
      label: 'Saques Pendentes',
      rawValue: globalPendencies.financeiro_saques_pendentes + globalPendencies.financeiro_prestador_saques_pendentes,
      displayValue: String(globalPendencies.financeiro_saques_pendentes + globalPendencies.financeiro_prestador_saques_pendentes),
      icon: Wallet,
      color: 'text-rose-600', bg: 'bg-rose-50',
      trend: 'Aguardando', trendUp: false,
      badge: globalPendencies.financeiro_saques_pendentes,
      hidden: adminType === 'colaborador' && !colaboradorModulos.includes('financeiro'),
      onClick: () => onNavigate?.('financeiro', 'saques'),
    },
    {
      label: 'Clientes Ativos',
      rawValue: stats.clientesTotal,
      displayValue: String(stats.clientesTotal),
      icon: Users,
      color: 'text-blue-600', bg: 'bg-blue-50',
      trend: 'Cadastros', trendUp: true,
      badge: globalPendencies.cadastro_clientes_inativos + globalPendencies.cadastro_clientes_bloqueados,
      hidden: adminType === 'colaborador' && !colaboradorModulos.includes('cadastro'),
      onClick: () => onNavigate?.('cadastro', 'clientes'),
    },
    {
      label: 'Cobranças Ativas',
      rawValue: globalPendencies.cobrancas_pendentes + globalPendencies.cobrancas_criticas,
      displayValue: String(globalPendencies.cobrancas_pendentes + globalPendencies.cobrancas_criticas),
      icon: Gavel,
      color: 'text-violet-600', bg: 'bg-violet-50',
      trend: 'Recuperação', trendUp: false,
      badge: globalPendencies.cobrancas_pendentes + globalPendencies.cobrancas_criticas,
      hidden: adminType === 'colaborador' && !colaboradorModulos.includes('cobranca'),
      onClick: () => onNavigate?.('cobranca', 'fila'),
    },
    {
      label: 'Promoções em Uso',
      rawValue: stats.promocoesAtivas,
      displayValue: String(stats.promocoesAtivas),
      icon: Target,
      color: 'text-fuchsia-600', bg: 'bg-fuchsia-50',
      trend: 'Cupons Ativos', trendUp: true,
      badge: 0,
      hidden: adminType === 'colaborador' && !colaboradorModulos.includes('vendas'),
      onClick: () => onNavigate?.('vendas', 'promocoes'),
    },
    {
      label: 'Crédito Solicitado',
      rawValue: undefined,
      displayValue: formatCurrency(stats.emprestimosValorPendente),
      icon: Banknote,
      color: 'text-cyan-600', bg: 'bg-cyan-50',
      trend: 'Em Análise', trendUp: false,
      badge: pendencies.emprestimos.length,
      hidden: adminType === 'colaborador' && !colaboradorModulos.includes('financeiro'),
      onClick: () => onNavigate?.('financeiro', 'emprestimos'),
    },
  ];

  /* ── Loading skeleton ── */
  if (loading) {
    return (
      <div className="space-y-10 pb-12 animate-fade-up">
        {/* Header skeleton */}
        <div className="bg-neutral-900 p-10 rounded-[2.5rem] h-28 skeleton-dark" />
        {/* KPI skeletons */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {[1,2,3,4,5].map(i => <SkeletonKpiCard key={i} />)}
        </div>
        {/* List skeletons */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {[1,2,3,4].map(i => <SkeletonListCard key={i} />)}
        </div>
      </div>
    );
  }

  /* ── Render principal ── */
  const GreetingIcon = greeting.Icon;

  return (
    <div className="space-y-8 pb-12">

      {/* ── Header ── */}
      <div className="relative bg-[#0F0F0F] p-8 md:p-10 rounded-[2.5rem] text-white overflow-hidden shadow-2xl border border-white/5 animate-fade-up">
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <GreetingIcon className={`h-5 w-5 ${greeting.color}`} />
              <span className="text-sm font-semibold text-white/50">{greeting.text}, {colaboradorNome || 'Admin'}!</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-10 w-1.5 bg-indigo-500 rounded-full shadow-[0_0_20px_rgba(99,102,241,0.7)]" />
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight uppercase bg-clip-text text-transparent bg-gradient-to-r from-white via-neutral-200 to-neutral-500">
                Painel de Controle
              </h1>
            </div>
            <p className="text-xs text-white/25 mt-2 font-semibold uppercase tracking-widest">
              {formatDate(new Date())}
            </p>
          </div>
          <BarChart3 className="hidden lg:block h-16 w-16 text-white/5 shrink-0" />
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {cards.filter(c => !c.hidden).map((card, i) => (
          <KpiCard key={i} index={i} {...card} />
        ))}
      </div>



      {/* ── Listas de pendências (2 colunas) ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Col 1 */}
        <div className="space-y-6">
          {/* Empréstimos */}
          {(adminType === 'admin' || colaboradorModulos.includes('vendas')) && (
            <PendencyCard
              title="Empréstimos em Análise"
              icon={Landmark}
              accent="emerald"
              count={pendencies.emprestimos.length}
              onViewAll={() => onNavigate?.('financeiro', 'emprestimos')}
            >
              {pendencies.emprestimos.length > 0 ? pendencies.emprestimos.map(e => (
                <div key={e.id} className="relative pl-3 rounded-2xl border border-neutral-100 p-4 hover:bg-neutral-50 transition-colors cursor-pointer">
                  <div className="absolute left-0 top-3 bottom-3 w-0.5 bg-emerald-400 rounded-full" />
                  <p className="font-black text-neutral-900 uppercase tracking-tight text-sm">{e.codigo_emprestimo || 'EMP-' + e.id.substring(0, 4)}</p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-[10px] font-semibold text-neutral-400">{e.clientes?.nome} · {formatCurrency(e.valor_solicitado)}</p>
                    <span className="text-[10px] text-neutral-300 font-semibold">{relativeTime(e.created_at)}</span>
                  </div>
                </div>
              )) : <EmptyRow text="Nenhum empréstimo em análise" />}
            </PendencyCard>
          )}

          {/* Orçamentos */}
          {(adminType === 'admin' || colaboradorModulos.includes('vendas')) && (
            <PendencyCard
              title="Orçamentos Pendentes"
              icon={FileText}
              accent="emerald"
              count={pendencies.orcamentos.length}
              onViewAll={() => onNavigate?.('vendas', 'orcamentos')}
            >
              {pendencies.orcamentos.length > 0 ? pendencies.orcamentos.map(o => (
                <div key={o.id} className="relative pl-3 rounded-2xl border border-neutral-100 p-4 hover:bg-neutral-50 transition-colors cursor-pointer">
                  <div className="absolute left-0 top-3 bottom-3 w-0.5 bg-emerald-400 rounded-full" />
                  <p className="font-black text-neutral-900 uppercase tracking-tight text-sm">{o.codigo_orcamento}</p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-[10px] font-semibold text-neutral-400">{o.clientes?.nome} · {o.status}</p>
                    <span className="text-[10px] text-neutral-300 font-semibold">{relativeTime(o.data_criacao)}</span>
                  </div>
                </div>
              )) : <EmptyRow text="Nenhum orçamento pendente" />}
            </PendencyCard>
          )}

          {/* Ordens */}
          {(adminType === 'admin' || colaboradorModulos.includes('vendas')) && (
            <PendencyCard
              title="Ordens Pendentes"
              icon={ClipboardList}
              accent="indigo"
              count={pendencies.os.length}
              onViewAll={() => onNavigate?.('vendas', 'os')}
            >
              {pendencies.os.length > 0 ? pendencies.os.map(order => (
                <div key={order.id} className="relative pl-3 group rounded-2xl border border-neutral-100 p-4 transition-all hover:border-indigo-200 hover:bg-indigo-50/30 cursor-pointer">
                  <div className={`absolute left-0 top-3 bottom-3 w-0.5 rounded-full ${
                    order.type === 'OS' ? 'bg-blue-400' : order.type === 'OC' ? 'bg-purple-400' : 'bg-emerald-400'
                  }`} />
                  <div className="flex items-center justify-between mb-1">
                    <span className={`rounded-lg px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                      order.type === 'OS' ? 'bg-blue-50 text-blue-600' : 
                      order.type === 'OC' ? 'bg-purple-50 text-purple-600' : 'bg-emerald-50 text-emerald-600'
                    }`}>
                      {order.type} · {order.status}
                    </span>
                    <span className="text-[10px] text-neutral-300 font-semibold">{relativeTime(order._date)}</span>
                  </div>
                  <p className="font-black text-neutral-900 uppercase tracking-tight text-sm">{order.clientes?.nome}</p>
                </div>
              )) : <EmptyRow text="Nenhuma ordem pendente" />}
            </PendencyCard>
          )}

          {/* Saques */}
          {(adminType === 'admin' || colaboradorModulos.includes('financeiro')) && (
            <PendencyCard
              title="Saques Pendentes"
              icon={Wallet}
              accent="rose"
              count={pendencies.saques.length}
              onViewAll={() => onNavigate?.('financeiro', 'saques')}
            >
              {pendencies.saques.length > 0 ? pendencies.saques.map(s => (
                <div key={s.id} className="flex items-center justify-between rounded-2xl bg-neutral-50 p-4 hover:bg-neutral-100 transition-colors ring-1 ring-black/5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-neutral-900 uppercase tracking-tight">{s.clientes?.nome}</p>
                    <p className="text-[10px] font-semibold text-neutral-400 mt-0.5">{formatCurrency(s.valor)}</p>
                  </div>
                  <button
                    onClick={() => handleApproveSaque(s.id)}
                    className="shrink-0 rounded-xl bg-white p-2.5 text-indigo-600 shadow-sm ring-1 ring-neutral-200 hover:bg-indigo-600 hover:text-white transition-all active:scale-95"
                  >
                    <CheckCircle2 className="h-5 w-5" />
                  </button>
                </div>
              )) : <EmptyRow text="Sem saques pendentes" />}
            </PendencyCard>
          )}
        </div>

        {/* Col 2 */}
        <div className="space-y-6">
          {/* Cobranças Prioritárias */}
          {(adminType === 'admin' || colaboradorModulos.includes('cobranca')) && (
            <PendencyCard
              title="Cobranças Prioritárias"
              icon={Gavel}
              accent="rose"
              count={pendencies.cobrancas.length}
              onViewAll={() => onNavigate?.('cobranca', 'fila')}
            >
              {pendencies.cobrancas.length > 0 ? pendencies.cobrancas.map(c => (
                <div key={c.id} className="relative pl-3 rounded-2xl border border-neutral-100 p-4 hover:border-rose-200 hover:bg-rose-50/30 transition-all cursor-pointer">
                  <div className="absolute left-0 top-3 bottom-3 w-0.5 bg-rose-400 rounded-full" />
                  <p className="font-black text-neutral-900 uppercase tracking-tight text-sm">{c.clientes?.nome}</p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-[10px] font-semibold text-neutral-400">{formatCurrency(c.valor_original)} · {c.status.replace('_', ' ')}</p>
                    <span className="text-[10px] text-neutral-300 font-semibold">{relativeTime(c.created_at)}</span>
                  </div>
                </div>
              )) : <EmptyRow text="Sem cobranças prioritárias" />}
            </PendencyCard>
          )}

          {/* Faturas */}
          {(adminType === 'admin' || colaboradorModulos.includes('financeiro')) && (
            <PendencyCard
              title="Faturas Pendentes"
              icon={FileText}
              accent="amber"
              count={pendencies.faturas.length}
              onViewAll={() => onNavigate?.('financeiro', 'em_aberto')}
            >
              {pendencies.faturas.length > 0 ? pendencies.faturas.map(f => (
                <div key={f.id} className="flex items-center justify-between rounded-2xl bg-neutral-50 p-4 hover:bg-neutral-100 transition-colors ring-1 ring-black/5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-neutral-900 uppercase tracking-tight">{f.clientes?.nome}</p>
                    <p className="text-[10px] font-semibold text-neutral-400 mt-0.5">
                      {formatCurrency(f.valor_total)} · vence {formatDate(f.data_vencimento)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleMarkInvoicePaid(f.id)}
                    className="shrink-0 rounded-xl bg-white p-2.5 text-emerald-600 shadow-sm ring-1 ring-neutral-200 hover:bg-emerald-600 hover:text-white transition-all active:scale-95"
                  >
                    <CheckCircle2 className="h-5 w-5" />
                  </button>
                </div>
              )) : <EmptyRow text="Tudo em dia! ✓" />}
            </PendencyCard>
          )}

          {/* Tickets */}
          {(adminType === 'admin' || colaboradorModulos.includes('tickets')) && (
            <PendencyCard
              title="Tickets Abertos"
              icon={MessageSquare}
              accent="rose"
              count={pendencies.tickets.length}
              onViewAll={() => onNavigate?.('tickets', 'abertos')}
            >
              {pendencies.tickets.length > 0 ? pendencies.tickets.map(t => (
                <div key={t.id} className="relative pl-3 rounded-2xl border border-neutral-100 p-4 hover:border-rose-200 hover:bg-rose-50/30 transition-all cursor-pointer">
                  <div className="absolute left-0 top-3 bottom-3 w-0.5 bg-rose-400 rounded-full" />
                  <p className="font-black text-neutral-900 uppercase tracking-tight text-sm">{t.assunto}</p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-[10px] font-semibold text-neutral-400">{t.clientes?.nome || 'Cliente'}</p>
                    <span className="text-[10px] text-neutral-300 font-semibold">{relativeTime(t.data_abertura)}</span>
                  </div>
                </div>
              )) : <EmptyRow text="Nenhum ticket aberto" />}
            </PendencyCard>
          )}

          {/* Loja: Trocas e Devoluções */}
          {(adminType === 'admin' || colaboradorModulos.includes('vendas')) && pendencies.trocas && (
            <PendencyCard
              title="Solicitações de Troca/Devolução"
              icon={AlertCircle}
              accent="amber"
              count={pendencies.trocas.length}
              onViewAll={() => onNavigate?.('vendas', 'orcamentos')}
            >
              {pendencies.trocas.length > 0 ? pendencies.trocas.map(tr => (
                <div key={tr.id} className="relative pl-3 rounded-2xl border border-neutral-100 p-4 hover:border-amber-200 hover:bg-amber-50/30 transition-all cursor-pointer">
                  <div className="absolute left-0 top-3 bottom-3 w-0.5 bg-amber-400 rounded-full" />
                  <p className="font-black text-neutral-900 uppercase tracking-tight text-sm">
                    {tr.tipo === 'troca' ? 'Troca' : 'Devolução'} - {tr.orcamentos?.codigo_orcamento}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-[10px] font-semibold text-neutral-400">{tr.clientes?.nome || 'Cliente'} - {tr.motivo}</p>
                    <span className="text-[10px] text-neutral-300 font-semibold">{relativeTime(tr.created_at)}</span>
                  </div>
                </div>
              )) : <EmptyRow text="Nenhuma solicitação de troca pendente" />}
            </PendencyCard>
          )}

          {/* Indicações */}
          {(adminType === 'admin' || colaboradorModulos.includes('cadastro')) && (
            <div className="relative rounded-[2rem] bg-[#0F0F0F] p-6 md:p-8 text-white shadow-2xl overflow-hidden border border-white/5">
              <div className="absolute top-0 right-0 -mt-10 -mr-10 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
                  <h3 className="text-base font-black flex items-center gap-3">
                    <div className="p-2 bg-white/10 rounded-xl">
                      <UserPlus className="h-4 w-4 text-white" />
                    </div>
                    Indicações Abertas
                  </h3>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest ring-1 ring-white/15">
                    {pendencies.indicacoes.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {pendencies.indicacoes.length > 0 ? pendencies.indicacoes.map(ind => (
                    <div key={ind.id} className="rounded-2xl bg-white/5 p-4 border border-white/5 hover:bg-white/10 transition-all">
                      <p className="text-sm font-black uppercase tracking-tight">{ind.indicado_nome}</p>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-[10px] font-semibold text-white/35">Por: {ind.indicador?.nome}</p>
                        <span className="text-[10px] text-white/25 font-semibold">{relativeTime(ind.data_indicacao)}</span>
                      </div>
                    </div>
                  )) : (
                    <p className="py-6 text-center text-[10px] font-black text-white/20 uppercase tracking-widest">Nenhuma indicação aberta</p>
                  )}
                </div>
                <button
                  onClick={() => onNavigate?.('cadastro', 'indicacoes')}
                  className="mt-6 w-full rounded-2xl bg-white py-4 text-xs font-black uppercase tracking-widest text-neutral-900 transition-all hover:bg-neutral-100 active:scale-95 shadow-xl"
                >
                  Gerenciar Programa
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

/* ── Sub-componentes auxiliares ── */
function PendencyCard({ title, icon: Icon, accent, count, onViewAll, children }: any) {
  const accents: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-600',
    indigo:  'bg-indigo-50 text-indigo-600',
    rose:    'bg-rose-50 text-rose-600',
    amber:   'bg-amber-50 text-amber-600',
  };
  const textAccents: Record<string, string> = {
    emerald: 'text-emerald-600 hover:text-emerald-700',
    indigo:  'text-indigo-600 hover:text-indigo-700',
    rose:    'text-rose-600 hover:text-rose-700',
    amber:   'text-amber-600 hover:text-amber-700',
  };

  return (
    <div className="rounded-[2rem] bg-white p-6 md:p-8 ring-1 ring-neutral-100 shadow-sm hover:shadow-lg transition-all">
      <div className="flex items-center justify-between mb-6 border-b border-neutral-100 pb-4">
        <h3 className="text-base font-black text-neutral-900 flex items-center gap-3">
          <div className={`p-2 rounded-xl ${accents[accent]}`}>
            <Icon className="h-4 w-4" />
          </div>
          {title}
        </h3>
        <div className="flex items-center gap-3">
          {count > 0 && (
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ring-1 ${
              accent === 'rose' ? 'bg-rose-50 text-rose-600 ring-rose-200' :
              accent === 'amber' ? 'bg-amber-50 text-amber-600 ring-amber-200' :
              accent === 'emerald' ? 'bg-emerald-50 text-emerald-600 ring-emerald-200' :
              'bg-indigo-50 text-indigo-600 ring-indigo-200'
            }`}>{count}</span>
          )}
          <button onClick={onViewAll} className={`text-[10px] font-black uppercase tracking-widest transition-colors ${textAccents[accent]}`}>
            Ver todos
          </button>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <p className="py-8 text-center text-[10px] font-black text-neutral-300 uppercase tracking-widest">{text}</p>
  );
}
