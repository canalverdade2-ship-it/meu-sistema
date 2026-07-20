import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Database, HardDrive, RefreshCw, Server, ShieldCheck, Users } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { callAdminRpc } from '../../lib/adminRpc';
import { formatDateTime } from '../../lib/utils';

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
  const [snapshot, setSnapshot] = useState<SystemSnapshot>({ metrics: {}, tables: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

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

  const cards = [
    { label: 'Banco de dados', value: formatBytes(metrics.database_size_bytes), icon: Database },
    { label: 'Storage', value: formatBytes(metrics.storage_size_bytes), icon: HardDrive },
    { label: 'Usuários Auth', value: numberValue(metrics.auth_users_count).toLocaleString('pt-BR'), icon: Users },
    { label: 'Tabelas', value: numberValue(metrics.database_tables_count || snapshot.tables?.length).toLocaleString('pt-BR'), icon: Server },
  ];

  if (loading) {
    return <div className="flex min-h-[420px] items-center justify-center"><RefreshCw className="h-9 w-9 animate-spin text-indigo-600" /></div>;
  }

  return (
    <div className="space-y-6 pb-10">
      <header className="rounded-[2rem] bg-neutral-950 p-6 text-white shadow-xl">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Observabilidade protegida</p>
            <h1 className="mt-2 flex items-center gap-3 text-2xl font-black"><ShieldCheck className="h-6 w-6 text-emerald-400" /> Saúde do Sistema</h1>
            <p className="mt-2 text-sm text-white/55">Visão somente leitura. O navegador não recebe permissão para consultar tabelas arbitrárias nem apagar arquivos.</p>
          </div>
          <button type="button" onClick={() => void load(true)} disabled={refreshing} className="flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-black text-neutral-900 disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Atualizar</button>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon }) => <article key={label} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Icon className="h-5 w-5" /></span><p className="mt-5 text-[10px] font-black uppercase tracking-wider text-neutral-400">{label}</p><p className="mt-1 text-2xl font-black text-neutral-900">{value}</p></article>)}
      </div>

      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-4 border-b border-neutral-100 p-5 sm:flex-row sm:items-center">
          <div><h2 className="flex items-center gap-2 text-lg font-black"><Activity className="h-5 w-5 text-indigo-600" /> Estatísticas das tabelas</h2><p className="mt-1 text-sm text-neutral-500">Estimativas fornecidas pelo PostgreSQL, sem leitura do conteúdo das linhas.</p></div>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar tabela" className="rounded-xl border border-neutral-200 px-4 py-2.5 text-sm" />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-neutral-50 text-[10px] font-black uppercase tracking-wider text-neutral-500"><tr><th className="px-4 py-3">Tabela</th><th className="px-4 py-3">Linhas estimadas</th><th className="px-4 py-3">Linhas mortas</th><th className="px-4 py-3">Última análise</th></tr></thead>
            <tbody className="divide-y divide-neutral-100">{filteredTables.map((table) => <tr key={table.table}><td className="px-4 py-3 font-mono text-xs font-bold text-neutral-800">{table.table}</td><td className="px-4 py-3">{numberValue(table.estimated_rows).toLocaleString('pt-BR')}</td><td className="px-4 py-3">{numberValue(table.dead_rows).toLocaleString('pt-BR')}</td><td className="px-4 py-3 text-neutral-500">{table.last_analyze || table.last_autoanalyze ? formatDateTime(table.last_analyze || table.last_autoanalyze || '') : '—'}</td></tr>)}</tbody>
          </table>
        </div>
        {filteredTables.length === 0 && <div className="p-12 text-center text-neutral-400">Nenhuma tabela encontrada.</div>}
      </section>

      <p className="text-right text-xs text-neutral-400">Snapshot gerado em {snapshot.generated_at ? formatDateTime(snapshot.generated_at) : '—'}</p>
    </div>
  );
}
