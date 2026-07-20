import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Database, 
  HardDrive, 
  Users, 
  RefreshCw, 
  Server,
  Activity,
  CalendarDays,
  ShieldCheck,
  Zap,
  Clock,
  MessageSquare,
  Globe,
  Code,
  Trash2,
  ExternalLink,
  Lock,
  AlertTriangle,
  Search,
  Info
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Modal } from '../ui/Modal';
import { toast } from 'react-hot-toast';
import { logService } from '../../lib/logService';

// Limites do Plano Automático (Free Plan)
const LIMIT_DB_BYTES = 500 * 1024 * 1024; // 500MB
const LIMIT_STORAGE_BYTES = 1 * 1024 * 1024 * 1024; // 1GB
const LIMIT_AUTH_USERS = 50000;
const LIMIT_EGRESS_BYTES = 5 * 1024 * 1024 * 1024; // 5GB
const LIMIT_REALTIME_MESSAGES = 2000000; // 2 Milhões
const LIMIT_EDGE_FUNCTIONS = 500000; // 500 mil

const BILLING_CYCLE_DAY = 26;

interface SystemMetrics {
  database_size_bytes: number;
  storage_size_bytes: number;
  auth_users_count: number;
  database_tables_count: number;
  realtime_messages?: number;
  edge_functions?: number;
  egress_bytes?: number;
}

export function SystemMonitorModule({ colaboradorId, colaboradorNome }: { colaboradorId?: string, colaboradorNome?: string | null }) {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const [detailModal, setDetailModal] = useState<'database' | 'storage' | 'users' | null>(null);
  const [detailData, setDetailData] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailSearch, setDetailSearch] = useState('');
  const [deleteData, setDeleteData] = useState<{files: any[], refs: any[]} | null>(null);
  const [activeTabStorage, setActiveTabStorage] = useState('Todos');
  const [selectedFiles, setSelectedFiles] = useState<any[]>([]);

  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<any[]>([]);
  const [tableLoading, setTableLoading] = useState(false);

  const handleOpenDetail = async (type: 'database' | 'storage' | 'users') => {
    setDetailModal(type);
    setDetailLoading(true);
    setDetailData([]);
    setDetailSearch('');
    setActiveTabStorage('Todos');
    setSelectedFiles([]);
    setSelectedTable(null);
    setTableData([]);
    
    try {
      let rpcName = '';
      if (type === 'database') rpcName = 'get_database_details';
      if (type === 'storage') rpcName = 'get_storage_details';
      if (type === 'users') rpcName = 'get_auth_users_details';

      const { data, error } = await supabase.rpc(rpcName);
      if (error) throw error;
      setDetailData(data || []);
    } catch (err) {
      console.error('Erro ao buscar detalhes:', err);
      toast.error('Erro ao buscar detalhes.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleTableClick = async (tableName: string) => {
    setSelectedTable(tableName);
    setTableLoading(true);
    try {
      const { data, error } = await supabase.from(tableName).select('*').limit(1500);
      if (error) throw error;
      setTableData(data || []);
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao ler tabela: ' + err.message);
      setTableData([]);
    } finally {
      setTableLoading(false);
    }
  };

  const handleCheckFile = async (file: any) => {
    try {
      const { data, error } = await supabase.rpc('check_file_references', { p_file_url: file.name });
      if (error) throw error;
      setDeleteData({ files: [file], refs: data || [] });
    } catch (err) {
      console.error('Erro ao checar ref:', err);
      toast.error('Erro ao verificar o arquivo.');
    }
  };

  const handleBulkCheckFiles = async () => {
    if (selectedFiles.length === 0) return;
    setDetailLoading(true);
    try {
      let allRefs: any[] = [];
      
      const results = await Promise.all(
        selectedFiles.map(async (f) => {
          const { data, error } = await supabase.rpc('check_file_references', { p_file_url: f.name });
          if (error) throw error;
          return { file: f, refs: data || [] };
        })
      );
      
      for (const res of results) {
        if (res.refs.length > 0) {
          allRefs = [...allRefs, ...res.refs.map((r: any) => ({ ...r, file_name: res.file.name }))];
        }
      }
      
      setDeleteData({ files: selectedFiles, refs: allRefs });
    } catch (err) {
      console.error('Erro ao checar bulk refs:', err);
      toast.error('Erro ao verificar referências dos arquivos.');
    } finally {
      setDetailLoading(false);
    }
  };

  const confirmDeleteFile = async () => {
    if (!deleteData) return;
    try {
      const { files, refs } = deleteData;
      
      for (const ref of refs) {
        await supabase.from(ref.table).update({ [ref.column]: null }).eq('id', ref.id);
      }
      
      const byBucket: Record<string, string[]> = {};
      for (const f of files) {
        if (!byBucket[f.bucket_id]) byBucket[f.bucket_id] = [];
        byBucket[f.bucket_id].push(f.name);
      }
      
      for (const bucket in byBucket) {
        const { error } = await supabase.storage.from(bucket).remove(byBucket[bucket]);
        if (error) throw error;
      }
      
      toast.success(`${files.length} arquivo(s) removido(s) com sucesso!`);
      
      // Log Action
      await logService.logAction({
        acao: 'EXCLUIR_ARQUIVO_STORAGE',
        ator_tipo: colaboradorNome ? 'colaborador' : 'admin',
        ator_id: colaboradorId || undefined,
        ator_nome: colaboradorNome || 'Administrador',
        detalhes: `Removeu permanentemente ${files.length} arquivo(s) do storage. Buckets: ${Array.from(new Set(files.map(f => f.bucket_id))).join(', ')}`
      });

      setDeleteData(null);
      setSelectedFiles([]);
      handleOpenDetail('storage');
    } catch (err) {
      console.error('Erro ao excluir:', err);
      toast.error('Erro ao excluir arquivo(s).');
    }
  };

  const fetchMetrics = async (hideLoading = false) => {
    try {
      if (!hideLoading) setLoading(true);
      setRefreshing(true);
      
      const { data, error } = await supabase.rpc('get_system_metrics');
      if (error) throw error;
      
      if (data) {
        setMetrics(data as SystemMetrics);
        setLastUpdate(new Date());
      }
    } catch (err) {
      console.error('Network/RPC falhou ao buscar métricas', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    // Auto-refresh a cada 30 segundos
    const interval = setInterval(() => fetchMetrics(true), 30000);
    return () => clearInterval(interval);
  }, []);

  // Formaters
  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('pt-BR').format(num);
  };

  // Calcula próxima renovação (Dia 26)
  const getNextRenewalDate = () => {
    const today = new Date();
    let renewal = new Date(today.getFullYear(), today.getMonth(), BILLING_CYCLE_DAY);
    if (today.getDate() >= BILLING_CYCLE_DAY) {
      renewal.setMonth(renewal.getMonth() + 1);
    }
    return renewal;
  };

  const getDaysUntilRenewal = () => {
    const today = new Date();
    const renewal = getNextRenewalDate();
    const diffTime = Math.abs(renewal.getTime() - today.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Componente de Gráfico Circular
  const CircularProgress = ({ value, max, label, icon: Icon, colorClass, highlightClass, onClick }: any) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));
    const circumference = 2 * Math.PI * 40; // r=40
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
      <div 
        onClick={onClick}
        className={`bg-white rounded-2xl p-6 shadow-sm border border-black/[0.04] flex flex-col items-center relative overflow-hidden group transition-all ${onClick ? 'cursor-pointer hover:shadow-lg hover:-translate-y-1' : 'hover:shadow-md'}`}
      >
        {onClick && (
          <div className="absolute inset-0 bg-neutral-900/0 group-hover:bg-neutral-900/[0.02] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10">
            <span className="bg-white/90 backdrop-blur pb-1 mt-32 px-4 py-2 rounded-full text-xs font-bold shadow-sm flex items-center gap-1.5 text-neutral-600">
              <ExternalLink className="w-3.5 h-3.5" /> Detalhes
            </span>
          </div>
        )}
        <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl ${highlightClass} opacity-10 rounded-bl-[100px] -z-10 transition-transform group-hover:scale-110`} />
        
        <div className="flex items-center gap-2 mb-6 self-start w-full">
          <div className={`p-2 rounded-lg ${colorClass} bg-opacity-10`}>
            <Icon className={`w-5 h-5 ${colorClass.replace('bg-', 'text-')}`} />
          </div>
          <h3 className="font-bold text-[#1a1a1a]">{label}</h3>
        </div>

        <div className="relative flex items-center justify-center">
          <svg className="w-32 h-32 transform -rotate-90">
            <circle
              className="text-neutral-100"
              strokeWidth="8"
              stroke="currentColor"
              fill="transparent"
              r="40"
              cx="64"
              cy="64"
            />
            <motion.circle
              className={colorClass.replace('bg-', 'text-')}
              strokeWidth="8"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              strokeLinecap="round"
              stroke="currentColor"
              fill="transparent"
              r="40"
              cx="64"
              cy="64"
            />
          </svg>
          <div className="absolute flex flex-col items-center justify-center">
            <span className="text-2xl font-black text-[#1a1a1a]">{percentage.toFixed(1)}%</span>
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Usado</span>
          </div>
        </div>

        <div className="w-full mt-6 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-neutral-500 font-medium">Atual</span>
            <span className="font-bold text-[#142030]">{typeof value === 'number' && max > 100000 ? (max === LIMIT_REALTIME_MESSAGES || max === LIMIT_EDGE_FUNCTIONS ? formatNumber(value) : formatBytes(value)) : value}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-neutral-500 font-medium">Limite (Free)</span>
            <span className="font-bold text-[#1a1a1a]">{typeof max === 'number' && max > 100000 ? (max === LIMIT_REALTIME_MESSAGES || max === LIMIT_EDGE_FUNCTIONS ? formatNumber(max) : formatBytes(max)) : max}</span>
          </div>
        </div>
      </div>
    );
  };

  if (loading && !metrics) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="w-12 h-12 border-4 border-[#142030]/20 border-t-[#142030] rounded-full animate-spin" />
        <p className="text-[#1a1a1a]/60 font-medium animate-pulse">Inspecionando infraestrutura...</p>
      </div>
    );
  }

  // Fallbacks if data fails
  const dbSize = metrics?.database_size_bytes || 0;
  const storageSize = metrics?.storage_size_bytes || 0;
  const activeUsers = metrics?.auth_users_count || 0;
  const tablesCount = metrics?.database_tables_count || 0;
  const egressBytes = metrics?.egress_bytes || 0;
  const realtimeMessages = metrics?.realtime_messages || 0;
  const edgeFunctions = metrics?.edge_functions || 0;

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#1a1a1a] flex items-center gap-3">
            <Server className="w-8 h-8 text-[#142030]" />
            Saúde do Sistema
          </h1>
          <p className="text-[#1a1a1a]/60 mt-2 font-medium">
            Monitoramento em tempo real da infraestrutura e limites do plano (Free Plan).
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-neutral-500 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Visto às {lastUpdate?.toLocaleTimeString()}
          </span>
          <button 
            onClick={() => fetchMetrics(false)}
            disabled={refreshing}
            className="flex items-center gap-2 bg-white border border-black/10 hover:bg-neutral-50 text-[#1a1a1a] px-4 py-2.5 rounded-xl font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar Agora
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-gradient-to-br from-[#142030] to-[#20344d] rounded-2xl p-6 text-white shadow-lg shadow-[#142030]/20 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-white/80">Plano Atual</h3>
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-3xl font-black mb-1">Free Tier</div>
          <div className="text-sm text-white/60 font-medium">Ambiente Saudável</div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-black/5 shadow-sm relative overflow-hidden group tracking-tight">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-neutral-500">Próxima Renovação</h3>
            <CalendarDays className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-3xl font-black text-[#1a1a1a] mb-1">Dia {BILLING_CYCLE_DAY}</div>
          <div className="text-sm font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md inline-block">
            Faltam {getDaysUntilRenewal()} dias
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-black/5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-neutral-500">Tabelas Ativas</h3>
            <Activity className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-3xl font-black text-[#1a1a1a] mb-1">{tablesCount}</div>
          <div className="text-sm text-neutral-400 font-medium">Esquema Public</div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-black/5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-neutral-500">Motor Postgres</h3>
            <Zap className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="text-xl font-black text-[#1a1a1a] mb-1 mt-2">Versão 17.6.1</div>
          <div className="text-sm font-bold text-emerald-600 flex items-center gap-1.5 mt-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Online & Otimizado
          </div>
        </div>
      </div>

      {/* Gráficos de Consumo */}
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-black text-[#1a1a1a] tracking-tight ml-1">Uso de Recursos ao Vivo</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <CircularProgress 
            value={dbSize}
            max={LIMIT_DB_BYTES}
            label="Database Size"
            icon={Database}
            colorClass="bg-blue-600"
            highlightClass="from-blue-500 to-transparent"
            onClick={() => handleOpenDetail('database')}
          />
          <CircularProgress 
            value={storageSize}
            max={LIMIT_STORAGE_BYTES}
            label="Storage Size"
            icon={HardDrive}
            colorClass="bg-amber-500"
            highlightClass="from-amber-400 to-transparent"
            onClick={() => handleOpenDetail('storage')}
          />
        </div>
      </div>

      {/* MODAL PRINCIPAL COMPARTILHADO */}
      <Modal isOpen={detailModal !== null} onClose={() => { setDetailModal(null); setDeleteData(null); setSelectedFiles([]); }} title={detailModal === 'database' ? 'Detalhes: Database Size' : detailModal === 'storage' ? 'Detalhes: Storage Size' : 'Detalhes: Auth Users'} size="5xl">
        <div className="space-y-4">
          
          {/* Header do Modal com total e busca */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-neutral-50 p-4 rounded-2xl ring-1 ring-neutral-200">
            <div>
              <p className="font-bold text-neutral-900 text-lg">
                {detailModal === 'database' && `${formatBytes(dbSize)} em ${detailData.length} Tabelas`}
                {detailModal === 'storage' && `${formatBytes(storageSize)} em ${detailData.length} Arquivos`}
                {detailModal === 'users' && `${detailData.length} Usuários Autenticados`}
              </p>
              <p className="text-xs text-neutral-500">Dados reais carregados dinamicamente.</p>
            </div>
            {(detailModal === 'database' || detailModal === 'storage') && (
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={detailSearch}
                  onChange={e => setDetailSearch(e.target.value)}
                  className="w-full rounded-xl bg-white ring-1 ring-neutral-200 py-2 pl-9 pr-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
            )}
          </div>

          {detailLoading ? (
            <div className="py-20 flex justify-center"><div className="h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div></div>
          ) : (
            <>
              {/* === CONTEÚDO DATABASE === */}
              {detailModal === 'database' && (
                selectedTable ? (
                  <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl ring-1 ring-neutral-200">
                      <button onClick={() => setSelectedTable(null)} className="flex items-center gap-2 text-sm font-bold text-neutral-600 hover:text-[#1a1a1a]">
                        ← Voltar para tabelas
                      </button>
                      <h3 className="font-black tracking-widest uppercase text-xs text-indigo-600">{selectedTable}</h3>
                    </div>
                    
                    {tableLoading ? (
                      <div className="py-20 flex justify-center"><div className="h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div></div>
                    ) : tableData.length === 0 ? (
                      <div className="py-20 text-center font-bold text-sm text-neutral-500 bg-neutral-50 rounded-2xl ring-1 ring-neutral-200">Nenhum registro encontrado ou painel bloqueado para esta tabela.</div>
                    ) : (
                      <div className="overflow-auto rounded-2xl ring-1 ring-neutral-200 max-h-[600px] custom-scrollbar bg-white shadow-inner">
                        <table className="min-w-full text-left text-xs whitespace-nowrap">
                          <thead className="bg-[#1a1a1a] text-white sticky top-0 z-10 shadow-md">
                            <tr>
                              {Object.keys(tableData[0]).map(col => (
                                <th key={col} className="px-4 py-3 font-black uppercase tracking-wider">{col}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-100">
                            {tableData.map((row, i) => (
                              <tr key={i} className="hover:bg-indigo-50/50 transition-colors">
                                {Object.keys(tableData[0]).map(col => {
                                  let val = row[col];
                                  if (typeof val === 'object' && val !== null) val = JSON.stringify(val);
                                  else if (typeof val === 'boolean') val = val ? 'Sim' : 'Não';
                                  return (
                                    <td key={col} className="px-4 py-2 border-r border-neutral-100 max-w-[250px] truncate" title={String(val ?? '')}>
                                      {String(val ?? '')}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ) : (
                <div className="overflow-x-auto rounded-2xl ring-1 ring-neutral-200">
                  <table className="w-full text-left">
                    <thead className="bg-[#1a1a1a] text-white">
                      <tr>
                        <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest sticky left-0 bg-[#1a1a1a]">Tabela</th>
                        <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-right">Tamanho</th>
                        <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-center">Colunas</th>
                        <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-center">Linhas Est.</th>
                        <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-center">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-neutral-100">
                      {detailData.filter(d => !detailSearch || d.table_name.toLowerCase().includes(detailSearch.toLowerCase())).map((t: any) => (
                        <tr key={t.table_name} className="hover:bg-indigo-50 cursor-pointer transition-colors" onClick={() => handleTableClick(t.table_name)}>
                          <td className="px-5 py-3 sticky left-0 bg-white/50 backdrop-blur font-bold text-sm text-neutral-800 flex flex-col gap-1">
                            {t.table_name}
                            <div className="w-full bg-neutral-100 h-1.5 rounded-full overflow-hidden mt-1 max-w-[120px]">
                              <div className="bg-indigo-500 h-full" style={{ width: `${Math.max(1, (t.total_bytes / Math.max(dbSize, 1)) * 100)}%` }} />
                            </div>
                          </td>
                          <td className="px-5 py-3 text-sm font-bold text-neutral-600 text-right">{t.size_pretty}</td>
                          <td className="px-5 py-3 text-sm text-neutral-600 text-center">{t.column_count}</td>
                          <td className="px-5 py-3 text-sm text-neutral-600 text-center">{t.estimated_rows > -1 ? t.estimated_rows : 0}</td>
                          <td className="px-5 py-3 text-center">
                            <span title={`Protegida. Referenciada por ${t.referenced_by_count} tabelas: ${t.referenced_by || 'nenhuma'}.\nA base não aceita exclusão de tabelas pelo painel para manter integridade.`} className="inline-flex items-center gap-1.5 bg-neutral-100 text-neutral-500 px-2 py-1 rounded-md text-[10px] font-bold cursor-help mx-auto">
                              <Lock className="w-3 h-3" /> Protegido
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                )
              )}

              {/* === CONTEÚDO STORAGE === */}
              {detailModal === 'storage' && (
                <div className="space-y-4">
                  <div className="flex gap-2 mb-2 overflow-x-auto pb-2">
                    {['Todos', ...Array.from(new Set(detailData.map(d => d.bucket_id)))].map((tab: string) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTabStorage(tab)}
                        className={`px-4 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${activeTabStorage === tab ? 'bg-[#1a1a1a] text-white shadow-md' : 'bg-white ring-1 ring-neutral-200 text-neutral-600 hover:bg-neutral-50'}`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  {deleteData && (
                    <div className="bg-red-50 ring-1 ring-red-200 rounded-2xl p-4 sm:p-5 flex flex-col gap-4 animate-in fade-in zoom-in-95">
                      <div className="flex gap-3">
                        <div className="h-10 w-10 bg-red-100 text-red-600 rounded-full flex items-center justify-center shrink-0">
                          <AlertTriangle className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-red-900 text-lg tracking-tight">Cuidado ao Excluir</h4>
                          <p className="text-sm text-red-700 mt-1">Você está prestes a apagar <strong>{deleteData.files.length} arquivo(s)</strong> definitivamente.</p>
                          
                          {deleteData.refs.length > 0 ? (
                            <div className="mt-4 bg-white/50 p-3 rounded-xl border border-red-200">
                              <p className="text-xs font-bold text-red-900 mb-2 uppercase tracking-wide">⚠️ Há arquivos REFERENCIADOS E UTILIZADOS no sistema:</p>
                              <ul className="space-y-1 text-xs text-red-800 font-medium max-h-32 overflow-y-auto">
                                {deleteData.refs.map((r, i) => (
                                  <li key={i}>Arquivo <span className="font-mono bg-red-100 px-1 rounded">{r.file_name || 'arquivo'}</span> → Tabela <strong className="text-red-900">{r.table}</strong> (id: {r.id})</li>
                                ))}
                              </ul>
                              <p className="text-xs text-red-700 mt-3 font-semibold">Prosseguir vai apagá-los do storage E limpar suas referências automaticamente nas tabelas acima.</p>
                            </div>
                          ) : (
                            <div className="mt-4 bg-emerald-50 text-emerald-700 p-3 rounded-xl border border-emerald-200">
                              <p className="text-xs font-bold mb-1">✅ Arquivos Órfãos</p>
                              <p className="text-xs">Nenhum registro ativo do banco de dados usa estes arquivos selecionados. Exclusão 100% segura.</p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-end gap-3 mt-2">
                        <button onClick={() => setDeleteData(null)} className="px-4 py-2 bg-white ring-1 ring-neutral-200 text-neutral-600 rounded-xl text-xs font-bold hover:bg-neutral-100">
                          Cancelar
                        </button>
                        <button onClick={confirmDeleteFile} className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-red-600/20 hover:bg-red-700">
                          Excluir Definitivamente
                        </button>
                      </div>
                    </div>
                  )}

                  {!deleteData && (
                    <>
                      {selectedFiles.length > 0 && (
                        <div className="flex justify-between items-center bg-indigo-50 px-4 py-3 rounded-xl ring-1 ring-indigo-200 animate-in fade-in slide-in-from-top-4">
                          <span className="text-sm font-bold text-indigo-900">{selectedFiles.length} arquivo(s) selecionado(s)</span>
                          <button
                            onClick={handleBulkCheckFiles}
                            className="flex items-center gap-2 bg-red-600 px-4 py-2 rounded-lg text-white text-xs font-bold shadow-sm hover:bg-red-700 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Excluir Selecionados
                          </button>
                        </div>
                      )}
                      
                      <div className="overflow-x-auto rounded-2xl ring-1 ring-neutral-200 max-h-[500px]">
                        <table className="w-full text-left relative">
                          <thead className="bg-[#1a1a1a] text-white">
                            <tr>
                              <th className="px-5 py-3 sticky top-0 bg-[#1a1a1a] w-10">
                                <input 
                                  type="checkbox" 
                                  className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-600 bg-white"
                                  checked={
                                    detailData.filter(d => activeTabStorage === 'Todos' || d.bucket_id === activeTabStorage).length > 0 &&
                                    selectedFiles.length === detailData.filter(d => activeTabStorage === 'Todos' || d.bucket_id === activeTabStorage).length
                                  }
                                  onChange={(e) => {
                                    const visibleFiles = detailData.filter(d => activeTabStorage === 'Todos' || d.bucket_id === activeTabStorage);
                                    if (e.target.checked) setSelectedFiles(visibleFiles);
                                    else setSelectedFiles([]);
                                  }}
                                />
                              </th>
                              <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest sticky top-0 bg-[#1a1a1a]">Arquivo</th>
                              <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-center sticky top-0 bg-[#1a1a1a]">Tamanho</th>
                              <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest sticky top-0 bg-[#1a1a1a]">Data Upload</th>
                              <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-center sticky top-0 bg-[#1a1a1a]">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-neutral-100">
                            {detailData
                              .filter(d => activeTabStorage === 'Todos' || d.bucket_id === activeTabStorage)
                              .filter(d => !detailSearch || d.name.toLowerCase().includes(detailSearch.toLowerCase()))
                              .map((f: any) => {
                                const publicUrl = `${supabase['supabaseUrl']}/storage/v1/object/public/${f.bucket_id}/${f.name}`;
                                return (
                                  <tr key={f.id} className={`hover:bg-neutral-50 ${selectedFiles.find(s => s.id === f.id) ? 'bg-indigo-50/50' : ''}`}>
                                    <td className="px-5 py-3">
                                      <input 
                                        type="checkbox" 
                                        className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-600"
                                        checked={!!selectedFiles.find(s => s.id === f.id)}
                                        onChange={(e) => {
                                          if (e.target.checked) setSelectedFiles([...selectedFiles, f]);
                                          else setSelectedFiles(selectedFiles.filter(s => s.id !== f.id));
                                        }}
                                      />
                                    </td>
                                    <td className="px-5 py-3 w-1/2">
                                      <p className="text-sm font-bold text-neutral-800 break-all">{f.name.split('/').pop()}</p>
                                      <p className="text-[10px] text-neutral-400 font-mono mt-0.5">{f.bucket_id} / {f.name}</p>
                                    </td>
                                    <td className="px-5 py-3 text-sm font-bold text-neutral-600 text-center">{f.size_pretty}</td>
                                    <td className="px-5 py-3 text-xs text-neutral-500">{new Date(f.created_at).toLocaleString('pt-BR')}</td>
                                    <td className="px-5 py-3">
                                      <div className="flex items-center justify-center gap-2">
                                        <a href={publicUrl} target="_blank" rel="noopener noreferrer" title="Ver Arquivo" className="h-8 w-8 bg-neutral-100 flex items-center justify-center rounded-lg text-neutral-600 hover:bg-[#1a1a1a] hover:text-white transition-all">
                                          <ExternalLink className="w-4 h-4" />
                                        </a>
                                        <button onClick={() => handleCheckFile(f)} title="Excluir Arquivo do Storage" className="h-8 w-8 bg-red-50 flex items-center justify-center rounded-lg text-red-600 hover:bg-red-600 hover:text-white transition-all">
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })
                            }
                            {detailData.length === 0 && (
                              <tr><td colSpan={5} className="p-8 text-center text-sm text-neutral-500">Nenhum arquivo encontrado.</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* === CONTEÚDO USERS === */}
              {detailModal === 'users' && (
                <div className="overflow-x-auto rounded-2xl ring-1 ring-neutral-200">
                  <table className="w-full text-left">
                    <thead className="bg-[#1a1a1a] text-white">
                      <tr>
                        <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest">Email</th>
                        <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-center">Provider</th>
                        <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest">Data Cadastro</th>
                        <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest">Último Login</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-neutral-100">
                      {detailData.map((u: any) => (
                        <tr key={u.id} className="hover:bg-neutral-50">
                          <td className="px-5 py-3 text-sm font-bold text-neutral-800">{u.email}</td>
                          <td className="px-5 py-3 text-center">
                            <span className="bg-neutral-100 text-neutral-600 px-2 py-1 rounded-md text-[10px] font-bold uppercase">{u.provider || 'email'}</span>
                          </td>
                          <td className="px-5 py-3 text-xs text-neutral-500">{new Date(u.created_at).toLocaleString('pt-BR')}</td>
                          <td className="px-5 py-3 text-xs text-neutral-500">{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString('pt-BR') : 'Nunca acessou'}</td>
                        </tr>
                      ))}
                      {detailData.length === 0 && (
                        <tr><td colSpan={4} className="p-8 text-center text-sm text-neutral-500 font-medium bg-neutral-50">Nenhum cadastro de usuário Auth encontrado na plataforma.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </Modal>
      
    </div>
  );
}
