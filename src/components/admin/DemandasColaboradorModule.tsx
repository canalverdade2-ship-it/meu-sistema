import React, { useState, useEffect } from 'react';
import {
  ClipboardList, Plus, RefreshCw, LayoutGrid, List, BarChart3,
  AlertCircle, Clock, CheckCircle2, Layers, DollarSign, TrendingUp
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { isPast } from 'date-fns';

import { DemandasKanban }       from './demandas/DemandasKanban';
import { DemandasTabela }       from './demandas/DemandasTabela';
import { DemandasDashboard }    from './demandas/DemandasDashboard';
import { NovaDemandaModal }     from './demandas/NovaDemandaModal';
import { DemandasDetalhesModal }from './demandas/DemandasDetalhesModal';

interface Props {
  colaboradorId?: string;
  colaboradorNome?: string;
  adminType?: 'admin' | 'colaborador';
  initialItemId?: string;
  initialTab?: string;
}

type View = 'kanban' | 'tabela' | 'performance';

export function DemandasColaboradorModule({ colaboradorId, colaboradorNome, adminType, initialItemId, initialTab }: Props) {
  const [demandas, setDemandas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('kanban');

  const [colaboradores, setColaboradores] = useState<any[]>([]);
  const [prestadores, setPrestadores] = useState<any[]>([]);

  const [selectedDemanda, setSelectedDemanda] = useState<any>(null);
  const [historico, setHistorico] = useState<any[]>([]);
  const [showDetalhes, setShowDetalhes] = useState(false);
  const [showNovaDemanda, setShowNovaDemanda] = useState(false);

  const isAdmin = adminType === 'admin';

  useEffect(() => {
    fetchDemandas();
    fetchAuxiliares();
  }, [colaboradorId, adminType]);

  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  // Auto-abrir e destaque via initialItemId
  useEffect(() => {
    if (initialItemId && demandas.length > 0) {
      const d = demandas.find(x => x.id === initialItemId || x.os_id === initialItemId);
      if (d) { 
        abrirDetalhes(d); 
        setHighlightedId(initialItemId);
        setTimeout(() => {
          const element = document.getElementById(`demanda-${initialItemId}`);
          if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 500);
        setTimeout(() => setHighlightedId(null), 4000);
      }
    }
  }, [initialItemId, demandas.length]);

  // Real-time synchronization
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const debouncedFetch = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(fetchDemandas, 300);
    };

    const channel = supabase
      .channel('colaborador-demandas-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prestador_demandas' }, debouncedFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prestador_demandas_historico' }, (payload) => {
        debouncedFetch();
        // Se a demanda aberta recebeu um novo histórico, atualiza o histórico do modal
        if (selectedDemanda && payload.new && (payload.new as any).demanda_id === selectedDemanda.id) {
           abrirDetalhes(selectedDemanda);
        }
      })
      .subscribe();

    return () => {
      clearTimeout(timeoutId);
      supabase.removeChannel(channel);
    };
  }, [selectedDemanda?.id]);

  const fetchDemandas = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('prestador_demandas')
        .select(`
          *,
          ordem_servico:ordens_servico(*, cliente:clientes(nome, telefone)),
          colaborador:colaboradores(nome),
          prestador:prestadores(nome_razao)
        `)
        .order('created_at', { ascending: false });

      if (adminType === 'colaborador' && colaboradorId) {
        query = query.eq('colaborador_id', colaboradorId);
      } else if (adminType === 'admin') {
        // Mostrar demandas atribuídas a colaboradores OU demandas que não estão abertas/canceladas (gestão operacional)
        query = query.or(`colaborador_id.not.is.null,and(status.neq.aberta,status.neq.cancelada)`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setDemandas(data || []);
    } catch (err) {
      toast.error('Erro ao carregar demandas.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAuxiliares = async () => {
    const [colabRes, prestRes] = await Promise.all([
      supabase.from('colaboradores').select('id, nome').eq('status', 'ativo'),
      supabase.from('prestadores').select('id, nome_razao').eq('status', 'ativo'),
    ]);
    setColaboradores(colabRes.data || []);
    setPrestadores(prestRes.data || []);
  };

  const refreshHistorico = async (demandaId: string) => {
    try {
      const { data, error } = await supabase
        .from('prestador_demandas_historico')
        .select(`
          *,
          origem:colaboradores!colaborador_origem_id(nome),
          destino:colaboradores!colaborador_destino_id(nome),
          destino_prestador:prestadores!prestador_destino_id(nome_razao),
          origem_prestador:prestadores!prestador_origem_id(nome_razao)
        `)
        .eq('demanda_id', demandaId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar histórico da demanda:', error);
        
        // Fallback: tentar buscar sem os joins se falhar por erro de relação
        if (error.code === 'PGRST100' || error.message?.includes('relation')) {
           const { data: fallbackData } = await supabase
            .from('prestador_demandas_historico')
            .select('*')
            .eq('demanda_id', demandaId)
            .order('created_at', { ascending: false });
           setHistorico(fallbackData || []);
        } else {
          setHistorico([]);
        }
        return;
      }

      setHistorico(data || []);
    } catch (err) {
      console.error('Erro inesperado ao buscar histórico:', err);
      setHistorico([]);
    }
  };

  const abrirDetalhes = async (d: any) => {
    setSelectedDemanda(d);
    setShowDetalhes(true);
    await refreshHistorico(d.id);
  };

  // --- Stats calculados ---
  const emAberto = demandas.filter(d => ['aguardando_atribuicao', 'aberta', 'em_ajuste', 'pendente_aceite'].includes(d.status)).length;
  const emExecucao = demandas.filter(d => d.status === 'ativa').length;
  const emAnalise = demandas.filter(d => d.status === 'em_analise').length;
  const emNegociacao = demandas.filter(d => ['em_negociacao', 'contraproposta_prestador', 'contraproposta_admin_final'].includes(d.status)).length;
  const vencidas = demandas.filter(d => d.prazo_limite && isPast(new Date(d.prazo_limite)) && !['concluida', 'concluida_interna', 'finalizada', 'cancelada'].includes(d.status)).length;
  const concluidas  = demandas.filter(d => ['concluida', 'finalizada', 'concluida_interna'].includes(d.status)).length;
  const urgentes = demandas.filter(d => d.prioridade === 'urgente' && !['concluida', 'concluida_interna', 'finalizada', 'cancelada'].includes(d.status)).length;
  const contrapropostas = demandas.filter(d => d.status === 'contraproposta_prestador').length;


  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4">
      {/* Header */}
      <div className="bg-[#1a1a1a] p-5 md:p-8 rounded-[2rem] text-white relative shadow-2xl overflow-hidden">
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col gap-5">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="h-8 w-1 bg-indigo-500 rounded-full shadow-[0_0_20px_rgba(99,102,241,0.6)]" />
              <h1 className="text-lg md:text-2xl font-black tracking-tight uppercase bg-clip-text text-transparent bg-gradient-to-r from-white via-neutral-100 to-neutral-400">
                Gestão Interna de Demandas
              </h1>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* View toggle */}
              {([
                { id: 'kanban',      label: 'Kanban',      icon: LayoutGrid },
                { id: 'tabela',      label: 'Tabela',      icon: List },
                { id: 'performance', label: 'Performance',  icon: BarChart3 },
              ] as { id: View; label: string; icon: React.ElementType }[]).map(v => (
                <button
                  key={v.id}
                  onClick={() => setView(v.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${view === v.id ? 'bg-white text-indigo-700' : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'}`}
                >
                  <v.icon className="h-3.5 w-3.5" />{v.label}
                </button>
              ))}

              <button onClick={fetchDemandas} className="h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center text-white/60 hover:bg-white/20 hover:text-white transition-all">
                <RefreshCw className="h-4 w-4" />
              </button>

              {isAdmin && (
                <button
                  onClick={() => setShowNovaDemanda(true)}
                  className="flex items-center gap-2 rounded-xl bg-indigo-500 px-5 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-900/30"
                >
                  <Plus className="h-4 w-4" /> Nova Demanda
                </button>
              )}
            </div>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {[
              { label: 'Em Aberto',    valor: emAberto,         icon: Layers,        color: 'text-white',         bg: 'bg-white/10' },
              { label: 'Em Execução',  valor: emExecucao,     icon: Clock,         color: 'text-blue-300',      bg: 'bg-blue-500/15' },
              { label: 'Em Análise',   valor: emAnalise,      icon: TrendingUp,    color: 'text-violet-300',    bg: 'bg-violet-500/15' },
              { label: 'Concluídas',   valor: concluidas,     icon: CheckCircle2,  color: 'text-emerald-300',   bg: 'bg-emerald-500/15' },
              { label: '💬 Negociação', valor: emNegociacao,   icon: DollarSign,   color: contrapropostas > 0 ? 'text-yellow-300 animate-pulse' : 'text-yellow-300', bg: 'bg-yellow-500/15' },
              { label: 'Vencidas 🔴',  valor: vencidas,       icon: AlertCircle,   color: 'text-red-300',       bg: 'bg-red-500/20' },
            ].map((s, i) => (
              <div key={i} className={`rounded-2xl ${s.bg} px-4 py-3 flex items-center gap-3`}>
                <s.icon className={`h-5 w-5 shrink-0 ${s.color}`} />
                <div>
                  <p className={`text-xl font-black ${s.color}`}>{s.valor}</p>
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Alertas */}
          {contrapropostas > 0 && (
            <div className="flex items-center gap-3 bg-yellow-500/20 border border-yellow-500/30 rounded-2xl px-5 py-3">
              <DollarSign className="h-5 w-5 text-yellow-300 shrink-0 animate-pulse" />
              <p className="text-sm font-bold text-yellow-300">
                ⚡ {contrapropostas} demanda(s) com CONTRAPROPOSTA do prestador aguardando sua resposta!
              </p>
              <button onClick={() => setView('kanban')} className="ml-auto text-xs font-black bg-yellow-400/20 text-yellow-200 px-3 py-1 rounded-full hover:bg-yellow-400/30 transition-all whitespace-nowrap">
                Ver Kanban →
              </button>
            </div>
          )}
          {vencidas > 0 && (
            <div className="flex items-center gap-3 bg-red-500/20 border border-red-500/30 rounded-2xl px-5 py-3">
              <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
              <p className="text-sm font-bold text-red-300">
                ⚠️ {vencidas} demanda(s) com prazo vencido! Verifique na aba Tabela → filtro "Vencidas".
              </p>
            </div>
          )}
          {urgentes > 0 && (
            <div className="flex items-center gap-3 bg-orange-500/20 border border-orange-500/30 rounded-2xl px-5 py-3">
              <AlertCircle className="h-5 w-5 text-orange-400 shrink-0" />
              <p className="text-sm font-bold text-orange-300">
                🔴 {urgentes} demanda(s) com prioridade URGENTE em aberto.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Conteúdo principal */}
      <div>
        {view === 'kanban' && (
          <DemandasKanban
            demandas={demandas}
            onVerDetalhes={abrirDetalhes}
            highlightedId={highlightedId}
          />
        )}
        {view === 'tabela' && (
          <DemandasTabela
            demandas={demandas}
            onVerDetalhes={abrirDetalhes}
            highlightedId={highlightedId}
          />
        )}
        {view === 'performance' && (
          <DemandasDashboard
            adminType={adminType}
            colaboradorId={colaboradorId}
          />
        )}
      </div>

      {/* Modal detalhes */}
      {showDetalhes && selectedDemanda && (
        <DemandasDetalhesModal
          demanda={selectedDemanda}
          initialTab={initialTab}
          historico={historico}
          colaboradorId={colaboradorId}
          colaboradorNome={colaboradorNome}
          adminType={adminType}
          colaboradores={colaboradores}
          prestadores={prestadores}
          onClose={() => setShowDetalhes(false)}
          onRefresh={fetchDemandas}
          onRefreshHistorico={() => refreshHistorico(selectedDemanda.id)}
        />
      )}

      {/* Modal nova demanda */}
      {showNovaDemanda && (
        <NovaDemandaModal
          colaboradorId={colaboradorId}
          colaboradorNome={colaboradorNome}
          onClose={() => setShowNovaDemanda(false)}
          onSuccess={fetchDemandas}
        />
      )}
    </div>
  );
}
