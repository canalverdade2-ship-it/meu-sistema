import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardList,
  FileText,
  Gavel,
  Landmark,
  MessageSquare,
  Receipt,
  Server,
  Settings,
  ShieldAlert,
  Users,
  Wallet,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatCurrency, formatDate, formatDateTime } from '../../lib/utils';
import { normalizeCollaboratorModules } from '../../security/collaboratorAccess';

interface Props {
  colaboradorId?: string;
  colaboradorNome?: string;
  colaboradorModulos: string[];
  onNavigate?: (module: string, tab?: string, itemId?: string) => void;
}

type Metric = {
  id: string;
  label: string;
  value: string;
  helper: string;
  icon: typeof Users;
  module: string;
  tab?: string;
};

const MODULE_TABLES: Record<string, string[]> = {
  cadastro: ['clientes', 'prestadores', 'cliente_documentos', 'prestador_documentos'],
  prestadores: ['prestadores', 'prestador_documentos'],
  vendas: ['orcamentos', 'ordens_servico', 'ordens_compra', 'ordens_assinatura'],
  demandas: ['prestador_demandas', 'prestador_demandas_historico'],
  financeiro: ['faturas', 'saques', 'transferencias', 'prestador_saques', 'emprestimos'],
  cobranca: ['cobrancas'],
  fiscal: ['ordens_fiscais'],
  tickets: ['tickets', 'ticket_mensagens'],
  acessos: ['solicitacoes_exclusao'],
};

export function CollaboratorDashboard({ colaboradorId, colaboradorNome, colaboradorModulos, onNavigate }: Props) {
  const modules = useMemo(() => normalizeCollaboratorModules(colaboradorModulos), [colaboradorModulos]);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [assignedDemands, setAssignedDemands] = useState<any[]>([]);

  const has = useCallback((permission: string) => modules.includes(permission), [modules]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const nextMetrics: Record<string, number> = {};
      const nextAmounts: Record<string, number> = {};
      const jobs: Promise<void>[] = [];

      const count = (key: string, promise: PromiseLike<{ count: number | null; error: any }>) => {
        jobs.push(Promise.resolve(promise).then(({ count: value, error }) => {
          if (error) throw error;
          nextMetrics[key] = value || 0;
        }));
      };

      if (has('cadastro')) {
        count('clientes', supabase.from('clientes').select('*', { count: 'exact', head: true }).eq('status', 'ativo'));
        count('cadastrosPendentes', supabase.from('clientes').select('*', { count: 'exact', head: true }).in('status', ['pendente', 'inativo', 'bloqueado']));
      }
      if (has('prestadores') || has('cadastro')) {
        count('prestadoresPendentes', supabase.from('prestadores').select('*', { count: 'exact', head: true }).in('status', ['pendente', 'em_analise']));
      }
      if (has('vendas')) {
        count('orcamentos', supabase.from('orcamentos').select('*', { count: 'exact', head: true }).in('status', ['aberto', 'negociação', 'em revisão']));
        count('ordens', supabase.from('ordens_servico').select('*', { count: 'exact', head: true }).in('status', ['aberto', 'aguardando', 'andamento']));
      }
      if (has('demandas') && colaboradorId) {
        count('demandas', supabase.from('prestador_demandas').select('*', { count: 'exact', head: true }).eq('colaborador_id', colaboradorId).not('status', 'in', '(concluida,concluida_interna,finalizada,cancelada)'));
        jobs.push((async () => {
          const { data, error } = await supabase
            .from('prestador_demandas')
            .select('id, titulo, status, prioridade, prazo_limite, created_at, ordem_servico:ordens_servico(codigo_os, cliente:clientes(nome))')
            .eq('colaborador_id', colaboradorId)
            .order('created_at', { ascending: false })
            .limit(6);
          if (error) throw error;
          setAssignedDemands(data || []);
        })());
      } else {
        setAssignedDemands([]);
      }
      if (has('financeiro')) {
        count('faturas', supabase.from('faturas').select('*', { count: 'exact', head: true }).in('status', ['pendente', 'vencida']));
        count('saques', supabase.from('saques').select('*', { count: 'exact', head: true }).eq('status', 'pendente'));
        jobs.push((async () => {
          const { data, error } = await supabase.from('emprestimos').select('valor_solicitado').in('status', ['analise', 'pendente', 'aguardando_assinatura']);
          if (error) throw error;
          nextAmounts.credito = (data || []).reduce((total, item) => total + (Number(item.valor_solicitado) || 0), 0);
        })());
      }
      if (has('cobranca')) count('cobrancas', supabase.from('cobrancas').select('*', { count: 'exact', head: true }).in('status', ['pendente', 'em_cobranca', 'acordo_quebrado']));
      if (has('tickets')) count('tickets', supabase.from('tickets').select('*', { count: 'exact', head: true }).in('status', ['aberto', 'em_andamento']));
      if (has('fiscal')) count('fiscal', supabase.from('ordens_fiscais').select('*', { count: 'exact', head: true }).in('status', ['pendente', 'erro']));
      if (has('acessos')) count('exclusoes', supabase.from('solicitacoes_exclusao').select('*', { count: 'exact', head: true }).eq('status', 'pendente'));

      await Promise.all(jobs);
      setMetrics(nextMetrics);
      setAmounts(nextAmounts);
    } catch (error) {
      console.error('Erro ao carregar painel do colaborador:', error);
    } finally {
      setLoading(false);
    }
  }, [colaboradorId, has]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  useEffect(() => {
    const tables = [...new Set(modules.flatMap((module) => MODULE_TABLES[module] || []))];
    if (tables.length === 0) return;
    let timer: number | undefined;
    const refresh = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => { void fetchData(); }, 500);
    };
    const channel = supabase.channel(`collaborator-dashboard-${colaboradorId || 'unknown'}`);
    tables.forEach((table) => (channel as any).on('postgres_changes', { event: '*', schema: 'public', table }, refresh));
    channel.subscribe();
    return () => {
      window.clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [colaboradorId, fetchData, modules]);

  const cards: Metric[] = [
    has('cadastro') && { id: 'clientes', label: 'Clientes ativos', value: String(metrics.clientes || 0), helper: `${metrics.cadastrosPendentes || 0} cadastros para revisar`, icon: Users, module: 'cadastro', tab: 'clientes' },
    (has('prestadores') || has('cadastro')) && { id: 'prestadores', label: 'Prestadores pendentes', value: String(metrics.prestadoresPendentes || 0), helper: 'Aguardando análise', icon: BriefcaseBusiness, module: 'prestadores' },
    has('vendas') && { id: 'orcamentos', label: 'Orçamentos pendentes', value: String(metrics.orcamentos || 0), helper: `${metrics.ordens || 0} ordens em andamento`, icon: ClipboardList, module: 'operacoes', tab: 'orcamentos' },
    has('demandas') && { id: 'demandas', label: 'Minhas demandas', value: String(metrics.demandas || 0), helper: 'Somente itens atribuídos a você', icon: CheckCircle2, module: 'demandas' },
    has('financeiro') && { id: 'faturas', label: 'Faturas pendentes', value: String(metrics.faturas || 0), helper: `${metrics.saques || 0} saques aguardando`, icon: Wallet, module: 'financeiro', tab: 'em_aberto' },
    has('financeiro') && { id: 'credito', label: 'Crédito em análise', value: formatCurrency(amounts.credito || 0), helper: 'Sem ações rápidas no resumo', icon: Landmark, module: 'financeiro', tab: 'emprestimos' },
    has('cobranca') && { id: 'cobrancas', label: 'Cobranças prioritárias', value: String(metrics.cobrancas || 0), helper: 'Fila de recuperação', icon: Gavel, module: 'cobranca', tab: 'fila' },
    has('tickets') && { id: 'tickets', label: 'Tickets abertos', value: String(metrics.tickets || 0), helper: 'Atendimento ao cliente', icon: MessageSquare, module: 'atendimento', tab: 'abertos' },
    has('fiscal') && { id: 'fiscal', label: 'Pendências fiscais', value: String(metrics.fiscal || 0), helper: 'Documentos para processar', icon: Receipt, module: 'fiscal' },
    has('relatorios') && { id: 'relatorios', label: 'Relatórios', value: 'Acessar', helper: 'Indicadores autorizados', icon: BarChart3, module: 'relatorios' },
    has('configuracoes') && { id: 'configuracoes', label: 'Configurações', value: 'Acessar', helper: 'Preferências do sistema', icon: Settings, module: 'configuracoes' },
    has('acessos') && { id: 'acessos', label: 'Exclusões pendentes', value: String(metrics.exclusoes || 0), helper: 'Gestão de acessos', icon: ShieldAlert, module: 'acessos' },
    has('sistema') && { id: 'sistema', label: 'Saúde do sistema', value: 'Monitorar', helper: 'Serviços e integrações', icon: Server, module: 'sistema' },
  ].filter(Boolean) as Metric[];

  return (
    <div className="space-y-7 pb-10">
      <section className="rounded-[2rem] bg-neutral-950 p-6 md:p-9 text-white shadow-xl">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-300">Painel do colaborador</p>
        <h1 className="mt-2 text-2xl md:text-4xl font-black">Olá, {colaboradorNome || 'Colaborador'}!</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/55">Você visualiza somente os módulos, indicadores e demandas permitidos para sua função.</p>
        <p className="mt-4 text-xs font-semibold text-white/30">Atualizado em {formatDateTime(new Date())}</p>
      </section>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => <div key={item} className="h-40 animate-pulse rounded-3xl bg-neutral-100" />)}
        </div>
      ) : cards.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <button key={card.id} type="button" onClick={() => onNavigate?.(card.module, card.tab)} className="group rounded-3xl border border-neutral-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white"><Icon className="h-5 w-5" /></span>
                <p className="mt-5 text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">{card.label}</p>
                <p className="mt-1 text-2xl font-black text-neutral-950">{card.value}</p>
                <p className="mt-2 text-xs font-semibold text-neutral-400">{card.helper}</p>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-900"><AlertCircle className="mb-3 h-6 w-6" /><p className="font-bold">Nenhum módulo operacional foi atribuído à sua conta.</p></div>
      )}

      {has('demandas') && (
        <section className="rounded-[2rem] border border-neutral-200 bg-white p-5 md:p-7 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div><p className="text-xs font-black uppercase tracking-[0.16em] text-neutral-400">Gestão interna</p><h2 className="mt-1 text-xl font-black text-neutral-950">Demandas atribuídas</h2></div>
            <button type="button" onClick={() => onNavigate?.('demandas')} className="rounded-xl bg-neutral-950 px-4 py-2 text-xs font-black text-white">Ver todas</button>
          </div>
          <div className="mt-5 space-y-3">
            {assignedDemands.length > 0 ? assignedDemands.map((demand) => (
              <button key={demand.id} type="button" onClick={() => onNavigate?.('demandas', undefined, demand.id)} className="flex w-full items-center justify-between gap-4 rounded-2xl border border-neutral-100 p-4 text-left hover:bg-neutral-50">
                <div className="min-w-0"><p className="truncate text-sm font-black text-neutral-900">{demand.titulo || demand.ordem_servico?.codigo_os || 'Demanda'}</p><p className="mt-1 truncate text-xs text-neutral-400">{demand.ordem_servico?.cliente?.nome || 'Atendimento interno'} · {demand.status}</p></div>
                <div className="shrink-0 text-right"><p className="text-[10px] font-bold uppercase text-neutral-400">{demand.prioridade || 'normal'}</p><p className="mt-1 text-xs text-neutral-400">{demand.prazo_limite ? formatDate(demand.prazo_limite) : 'Sem prazo'}</p></div>
              </button>
            )) : <p className="rounded-2xl bg-neutral-50 p-6 text-center text-sm font-semibold text-neutral-400">Nenhuma demanda atribuída.</p>}
          </div>
        </section>
      )}
    </div>
  );
}
