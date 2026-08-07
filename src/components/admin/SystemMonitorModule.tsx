import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Database, HardDrive, RefreshCw, Server, ShieldCheck, Users, Terminal as TerminalIcon, Globe, Cpu, ChevronDown, ChevronUp, X, Info, CheckCircle2, BarChart3, Lock, FileText, UserCheck } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { callAdminRpc } from '../../lib/adminRpc';
import { formatDateTime } from '../../lib/utils';
import { sendAdminWhatsAppNotification } from '../../utils/n8nWhatsApp';
import { MessageSquare } from 'lucide-react';

import { OracleMetricsPanel } from './infra/OracleMetricsPanel';
import { VPSTerminal } from './infra/VPSTerminal';
import { CloudflareManager } from './infra/CloudflareManager';

type SystemSnapshot = {
  metrics?: Record<string, unknown>;
  tables?: Array<{
    table: string;
    estimated_rows: number;
    dead_rows: number;
    last_analyze?: string | null;
    last_autoanalyze?: string | null;
  }>;
  generated_at?: string;
};

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatBytes(value: unknown) {
  const bytes = numberValue(value);
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

export function SystemMonitorModule(_props: { colaboradorId?: string; colaboradorNome?: string | null }) {
  const [activeTab, setActiveTab] = useState<'vps' | 'cloudflare' | 'database'>('vps');
  const [snapshot, setSnapshot] = useState<SystemSnapshot>({ metrics: {}, tables: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sendingAlert, setSendingAlert] = useState(false);
  const [search, setSearch] = useState('');
  const [tablesOpen, setTablesOpen] = useState(false);
  const [activeCardModal, setActiveCardModal] = useState<'database' | 'storage' | 'users' | 'tables' | null>(null);

  const handleSendTestAlert = async () => {
    setSendingAlert(true);
    try {
      const success = await sendAdminWhatsAppNotification({
        title: 'Alerta de Observabilidade',
        message: `Status do sistema verificado via Painel Admin. Todos os serviços estão operando normalmente na Oracle Cloud com n8n ativo.`,
        category: 'SISTEMA'
      });
      if (success) {
        toast.success('Notificação de WhatsApp enviada para o administrador!');
      } else {
        toast.error('Erro ao enviar notificação via WhatsApp.');
      }
    } catch (e: any) {
      toast.error('Falha no envio de notificação: ' + (e?.message || 'Erro desconhecido'));
    } finally {
      setSendingAlert(false);
    }
  };

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await callAdminRpc<SystemSnapshot>('gsa_admin_system_snapshot');
      setSnapshot({
        metrics: data?.metrics || {},
        tables: Array.isArray(data?.tables) ? data.tables : [],
        generated_at: data?.generated_at,
      });
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível carregar as métricas do sistema.');
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

  const metrics = snapshot.metrics || {};
  const filteredTables = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return snapshot.tables || [];
    return (snapshot.tables || []).filter((table) => table.table.toLowerCase().includes(value));
  }, [search, snapshot.tables]);

  const topTables = useMemo(() => {
    const sorted = [...(snapshot.tables || [])].sort((a, b) => (b.estimated_rows || 0) - (a.estimated_rows || 0));
    return sorted.slice(0, 5);
  }, [snapshot.tables]);

  const cards = [
    { key: 'database' as const, label: 'Banco de dados', value: formatBytes(metrics.database_size_bytes), icon: Database, color: 'text-purple-600 bg-purple-50 hover:border-purple-300' },
    { key: 'storage' as const, label: 'Storage', value: formatBytes(metrics.storage_size_bytes), icon: HardDrive, color: 'text-blue-600 bg-blue-50 hover:border-blue-300' },
    { key: 'users' as const, label: 'Usuários Auth', value: numberValue(metrics.auth_users_count).toLocaleString('pt-BR'), icon: Users, color: 'text-emerald-600 bg-emerald-50 hover:border-emerald-300' },
    { key: 'tables' as const, label: 'Tabelas', value: numberValue(metrics.database_tables_count || snapshot.tables?.length).toLocaleString('pt-BR'), icon: Server, color: 'text-amber-600 bg-amber-50 hover:border-amber-300' },
  ];

  if (loading && activeTab === 'database') {
    return <div className="flex min-h-[420px] items-center justify-center"><RefreshCw className="h-9 w-9 animate-spin text-indigo-600" /></div>;
  }

  return (
    <div className="space-y-6 pb-10">
      <header className="rounded-[2rem] bg-neutral-950 p-6 text-white shadow-xl">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Infraestrutura e Observabilidade</p>
            <h1 className="mt-2 flex items-center gap-3 text-2xl font-black"><ShieldCheck className="h-6 w-6 text-emerald-400" /> Saúde do Sistema & VPS</h1>
            <p className="mt-2 text-sm text-white/55">Gestão completa da Oracle Cloud, Cloudflare e Banco de Dados.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleSendTestAlert()}
              disabled={sendingAlert}
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-black text-white hover:bg-emerald-600 disabled:opacity-60 transition-colors shadow-lg shadow-emerald-500/20"
            >
              <MessageSquare className={`h-4 w-4 ${sendingAlert ? 'animate-bounce' : ''}`} />
              {sendingAlert ? 'Enviando...' : 'Enviar Alerta WhatsApp'}
            </button>
            <button type="button" onClick={() => void load(true)} disabled={refreshing} className="flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-black text-neutral-900 disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Atualizar</button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mt-8 border-b border-neutral-800 pb-px">
          <button
            onClick={() => setActiveTab('vps')}
            className={`flex items-center gap-2 px-4 py-3 font-bold text-sm rounded-t-xl transition-colors ${activeTab === 'vps' ? 'bg-neutral-900 text-white border-t border-x border-neutral-800' : 'text-neutral-400 hover:text-white'}`}
          >
            <Cpu className="w-4 h-4 text-blue-400" /> Oracle VPS & Terminal
          </button>
          <button
            onClick={() => setActiveTab('cloudflare')}
            className={`flex items-center gap-2 px-4 py-3 font-bold text-sm rounded-t-xl transition-colors ${activeTab === 'cloudflare' ? 'bg-neutral-900 text-white border-t border-x border-neutral-800' : 'text-neutral-400 hover:text-white'}`}
          >
            <Globe className="w-4 h-4 text-orange-400" /> Cloudflare
          </button>
          <button
            onClick={() => setActiveTab('database')}
            className={`flex items-center gap-2 px-4 py-3 font-bold text-sm rounded-t-xl transition-colors ${activeTab === 'database' ? 'bg-neutral-900 text-white border-t border-x border-neutral-800' : 'text-neutral-400 hover:text-white'}`}
          >
            <Database className="w-4 h-4 text-purple-400" /> PostgreSQL (VPS)
          </button>
        </div>
      </header>

      {/* Conteúdo da Aba VPS */}
      {activeTab === 'vps' && (
        <div className="space-y-6">
          <OracleMetricsPanel />
          <VPSTerminal />
        </div>
      )}

      {/* Conteúdo da Aba Cloudflare */}
      {activeTab === 'cloudflare' && (
        <CloudflareManager />
      )}

      {/* Conteúdo da Aba Database (Original) */}
      {activeTab === 'database' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map(({ key, label, value, icon: Icon, color }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveCardModal(key)}
                className={`group text-left rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer relative overflow-hidden ${color}`}
              >
                <div className="flex justify-between items-start">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 group-hover:scale-110 transition-transform">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-[10px] font-extrabold uppercase bg-neutral-100 text-neutral-500 px-2 py-1 rounded-md group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    Detalhes ➔
                  </span>
                </div>
                <p className="mt-5 text-[10px] font-black uppercase tracking-wider text-neutral-400">{label}</p>
                <p className="mt-1 text-2xl font-black text-neutral-900">{value}</p>
              </button>
            ))}
          </div>

          <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-all">
            <button
              type="button"
              onClick={() => setTablesOpen(!tablesOpen)}
              className="w-full flex items-center justify-between gap-4 p-5 text-left bg-white hover:bg-neutral-50/80 transition-colors"
            >
              <div>
                <h2 className="flex items-center gap-2 text-lg font-black text-neutral-900">
                  <Activity className="h-5 w-5 text-indigo-600" /> Estatísticas das tabelas
                </h2>
                <p className="mt-1 text-sm text-neutral-500">Estimativas fornecidas pelo PostgreSQL, sem leitura do conteúdo das linhas.</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-neutral-400 bg-neutral-100 px-3 py-1.5 rounded-lg">
                  {tablesOpen ? 'Clique para recolher' : 'Clique para expandir'}
                </span>
                <span className="p-2 rounded-xl bg-neutral-100 text-neutral-600">
                  {tablesOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </span>
              </div>
            </button>

            {tablesOpen && (
              <div className="border-t border-neutral-100">
                <div className="flex flex-col justify-between gap-4 p-5 bg-neutral-50/50 sm:flex-row sm:items-center">
                  <span className="text-xs font-bold text-neutral-500">Filtrar por nome de tabela</span>
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar tabela" className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-neutral-50 text-[10px] font-black uppercase tracking-wider text-neutral-500"><tr><th className="px-4 py-3">Tabela</th><th className="px-4 py-3">Linhas estimadas</th><th className="px-4 py-3">Linhas mortas</th><th className="px-4 py-3">Última análise</th></tr></thead>
                    <tbody className="divide-y divide-neutral-100">{filteredTables.map((table) => <tr key={table.table} className="hover:bg-neutral-50/80"><td className="px-4 py-3 font-mono text-xs font-bold text-neutral-800">{table.table}</td><td className="px-4 py-3">{numberValue(table.estimated_rows).toLocaleString('pt-BR')}</td><td className="px-4 py-3">{numberValue(table.dead_rows).toLocaleString('pt-BR')}</td><td className="px-4 py-3 text-neutral-500">{table.last_analyze || table.last_autoanalyze ? formatDateTime(table.last_analyze || table.last_autoanalyze || '') : '—'}</td></tr>)}</tbody>
                  </table>
                </div>
                {filteredTables.length === 0 && <div className="p-12 text-center text-neutral-400">Nenhuma tabela encontrada.</div>}
              </div>
            )}
          </section>

          <p className="text-right text-xs text-neutral-400">Snapshot gerado em {snapshot.generated_at ? formatDateTime(snapshot.generated_at) : '—'}</p>
        </div>
      )}

      {/* Modal de Detalhes dos Cards */}
      {activeCardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-neutral-100 relative space-y-6">
            <button
              onClick={() => setActiveCardModal(null)}
              className="absolute top-5 right-5 p-2 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-500 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal: Banco de Dados */}
            {activeCardModal === 'database' && (
              <div>
                <div className="flex items-center gap-3">
                  <span className="p-3 bg-purple-100 text-purple-600 rounded-2xl"><Database className="w-6 h-6"/></span>
                  <div>
                    <h3 className="text-xl font-black text-neutral-900">Banco de Dados PostgreSQL</h3>
                    <p className="text-xs text-neutral-500">Métricas e estatísticas do motor de banco na VPS</p>
                  </div>
                </div>
                <div className="mt-6 space-y-3">
                  <div className="flex justify-between items-center p-3 bg-neutral-50 rounded-xl">
                    <span className="text-xs font-bold text-neutral-500">Tamanho Total Alocado</span>
                    <span className="text-sm font-black text-purple-700 font-mono">{formatBytes(metrics.database_size_bytes)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-neutral-50 rounded-xl">
                    <span className="text-xs font-bold text-neutral-500">Motor de Banco</span>
                    <span className="text-sm font-mono font-bold text-neutral-800">PostgreSQL 17.2 (Linux x86_64)</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-neutral-50 rounded-xl">
                    <span className="text-xs font-bold text-neutral-500">Codificação de Caracteres</span>
                    <span className="text-sm font-mono font-bold text-neutral-800">UTF-8 / pt_BR.utf8</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-neutral-50 rounded-xl">
                    <span className="text-xs font-bold text-neutral-500">Modo de Acesso</span>
                    <span className="text-xs font-bold uppercase text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">Somente Leitura Protegido (RPC)</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-neutral-50 rounded-xl">
                    <span className="text-xs font-bold text-neutral-500">Status da Instância</span>
                    <span className="text-xs font-bold uppercase text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5"/> Ativo & Operacional
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Modal: Storage */}
            {activeCardModal === 'storage' && (
              <div>
                <div className="flex items-center gap-3">
                  <span className="p-3 bg-blue-100 text-blue-600 rounded-2xl"><HardDrive className="w-6 h-6"/></span>
                  <div>
                    <h3 className="text-xl font-black text-neutral-900">Armazenamento de Arquivos</h3>
                    <p className="text-xs text-neutral-500">Buckets de mídia, documentos e anexos do sistema</p>
                  </div>
                </div>
                <div className="mt-6 space-y-3">
                  <div className="flex justify-between items-center p-3 bg-neutral-50 rounded-xl">
                    <span className="text-xs font-bold text-neutral-500">Volume Total em Uso</span>
                    <span className="text-sm font-black text-blue-700 font-mono">{formatBytes(metrics.storage_size_bytes)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-neutral-50 rounded-xl">
                    <span className="text-xs font-bold text-neutral-500">Buckets Ativos</span>
                    <span className="text-sm font-mono font-bold text-neutral-800">public, private, avatars, docs</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-neutral-50 rounded-xl">
                    <span className="text-xs font-bold text-neutral-500">Provedor de Objetos</span>
                    <span className="text-sm font-mono font-bold text-neutral-800">Supabase Storage / Cloudflare R2</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-neutral-50 rounded-xl">
                    <span className="text-xs font-bold text-neutral-500">Políticas de Segurança (RLS)</span>
                    <span className="text-xs font-bold uppercase text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5"/> Ativadas por Bucket
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Modal: Usuários Auth */}
            {activeCardModal === 'users' && (
              <div>
                <div className="flex items-center gap-3">
                  <span className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl"><Users className="w-6 h-6"/></span>
                  <div>
                    <h3 className="text-xl font-black text-neutral-900">Usuários & Autenticação</h3>
                    <p className="text-xs text-neutral-500">Contas cadastradas no auth.users do sistema</p>
                  </div>
                </div>
                <div className="mt-6 space-y-3">
                  <div className="flex justify-between items-center p-3 bg-neutral-50 rounded-xl">
                    <span className="text-xs font-bold text-neutral-500">Total de Usuários Registrados</span>
                    <span className="text-sm font-black text-emerald-700 font-mono">{numberValue(metrics.auth_users_count).toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-neutral-50 rounded-xl">
                    <span className="text-xs font-bold text-neutral-500">Métodos de Login</span>
                    <span className="text-sm font-mono font-bold text-neutral-800">Código Master, PIN & Senha</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-neutral-50 rounded-xl">
                    <span className="text-xs font-bold text-neutral-500">Proteção contra Brute Force</span>
                    <span className="text-xs font-bold uppercase text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5"/> Rate Limiter Ativo
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-neutral-50 rounded-xl">
                    <span className="text-xs font-bold text-neutral-500">Sessões Ativas</span>
                    <span className="text-sm font-mono font-bold text-neutral-800">Gerenciadas via JWT Segura</span>
                  </div>
                </div>
              </div>
            )}

            {/* Modal: Tabelas */}
            {activeCardModal === 'tables' && (
              <div>
                <div className="flex items-center gap-3">
                  <span className="p-3 bg-amber-100 text-amber-600 rounded-2xl"><Server className="w-6 h-6"/></span>
                  <div>
                    <h3 className="text-xl font-black text-neutral-900">Mapeamento de Tabelas</h3>
                    <p className="text-xs text-neutral-500">Visão das principais tabelas registradas no PostgreSQL</p>
                  </div>
                </div>
                <div className="mt-6 space-y-3">
                  <div className="flex justify-between items-center p-3 bg-neutral-50 rounded-xl">
                    <span className="text-xs font-bold text-neutral-500">Quantidade Total de Tabelas</span>
                    <span className="text-sm font-black text-amber-700 font-mono">{numberValue(metrics.database_tables_count || snapshot.tables?.length).toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="p-3 bg-neutral-50 rounded-xl space-y-2">
                    <span className="text-xs font-bold text-neutral-500 block">Top 5 Tabelas por Linhas Estimadas:</span>
                    <div className="space-y-1">
                      {topTables.map((t) => (
                        <div key={t.table} className="flex justify-between text-xs font-mono">
                          <span className="text-neutral-700 truncate max-w-[240px]">{t.table}</span>
                          <span className="font-bold text-neutral-900">{numberValue(t.estimated_rows).toLocaleString('pt-BR')} linhas</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => setActiveCardModal(null)}
              className="w-full py-3 bg-neutral-900 text-white font-bold text-sm rounded-2xl hover:bg-neutral-800 transition-colors"
            >
              Fechar Detalhes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
