import React, { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import { supabase } from '../lib/supabase';
import { playPremiumBeep } from '../lib/utils';
import { showAnimatedToast } from '../lib/notifications';

// Constantes de reconexão
const HEARTBEAT_INTERVAL_MS = 30000; // 30s polling de fallback
const RECONNECT_DELAY_MS = 3000;     // 3s delay para reconexão

export interface ProviderPendencyCounts {
  demandas_novas: number;
  demandas_negociacao: number;
  servicos_ativos: number;
  financeiro_saques_pendentes: number;
  vouchers_ativos: number;
  suporte_tickets_ativos: number;
  suporte_mensagens_nao_lidas: number;
  promocoes_ativas: number;

  // Overall Total
  total: number;
  
  // Module specific for UI badges
  moduleDemandas: number;
  moduleDemandasAbertas: number;
  moduleDemandasAtivas: number;
  moduleAgenda: number;
  moduleFinanceiro: number;
  moduleVouchers: number;
  moduleSuporte: number;
  moduleDocumentos: number;
  modulePremios: number;
  modulePromocoes: number;

  // Custom for UI tabs (DB counts only)
  demandas_pendentes: number;
  demandas_em_execucao: number;
}

const defaultCounts: ProviderPendencyCounts = {
  demandas_novas: 0,
  demandas_negociacao: 0,
  servicos_ativos: 0,
  financeiro_saques_pendentes: 0,
  vouchers_ativos: 0,
  suporte_tickets_ativos: 0,
  suporte_mensagens_nao_lidas: 0,
  promocoes_ativas: 0,
  moduleDemandas: 0,
  moduleDemandasAbertas: 0,
  moduleDemandasAtivas: 0,
  moduleAgenda: 0,
  moduleFinanceiro: 0,
  moduleVouchers: 0,
  moduleSuporte: 0,
  moduleDocumentos: 0,
  modulePremios: 0,
  modulePromocoes: 0,
  demandas_pendentes: 0,
  demandas_em_execucao: 0,
  total: 0
};

interface ProviderNotificacao {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  lida: boolean;
  modulo?: string;
  tab?: string;
  item_id?: string;
  created_at: string;
  prioridade?: string;
}

interface ProviderNotificationContextType {
  pendencies: ProviderPendencyCounts;
  notifications: ProviderNotificacao[];
  unreadNotifications: number;
  prestador: any | null;
  loading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refreshCounts: () => Promise<void>;
}

const ProviderNotificationContext = createContext<ProviderNotificationContextType | undefined>(undefined);

export function ProviderNotificationProvider({ children, prestadorId }: { children: React.ReactNode, prestadorId: string }) {
  const [pendencies, setPendencies] = useState<ProviderPendencyCounts>(defaultCounts);
  const [notifications, setNotifications] = useState<ProviderNotificacao[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [prestador, setPrestador] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const registrationDateRef = useRef<string | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSubscribedRef = useRef(false);

  const fetchPrestador = useCallback(async () => {
    if (!prestadorId) return;
    try {
      const { data, error } = await supabase
        .from('prestadores')
        .select('*')
        .eq('id', prestadorId)
        .maybeSingle();
      
      if (error) throw error;
      setPrestador(data);
      if (data?.created_at) {
        registrationDateRef.current = data.created_at;
      }
    } catch (e) {
      console.error('Error fetching provider profile:', e);
    } finally {
      setLoading(false);
    }
  }, [prestadorId]);

  const fetchPendencies = useCallback(async () => {
    if (!prestadorId) return;

    try {
      const [rpcResponse, demandasResponse] = await Promise.all([
        supabase.rpc('get_provider_pendency_counts', { p_prestador_id: prestadorId }),
        supabase.from('prestador_demandas').select('status').eq('prestador_id', prestadorId)
      ]);

      const { data, error } = rpcResponse;
      if (error) throw error;

      // Manual count to bypass RPC limitations and align with UI logic
      const manualCounts = { novas: 0, negociacao: 0, ativas: 0 };
      if (demandasResponse.data) {
        demandasResponse.data.forEach(d => {
          if (d.status === 'aguardando_aceite') manualCounts.novas++;
          if (d.status === 'em_negociacao') manualCounts.negociacao++;
          if (['ativa', 'em_analise', 'em_ajuste', 'concluida_interna'].includes(d.status)) manualCounts.ativas++;
        });
      }

      const counts: ProviderPendencyCounts = {
        demandas_novas: manualCounts.novas,
        demandas_negociacao: manualCounts.negociacao,
        demandas_pendentes: manualCounts.novas + manualCounts.negociacao,
        demandas_em_execucao: manualCounts.ativas,
        servicos_ativos: data.servicos_ativos || 0,
        financeiro_saques_pendentes: data.financeiro_saques_pendentes || 0,
        vouchers_ativos: data.vouchers_ativos || 0,
        suporte_tickets_ativos: data.suporte_tickets_ativos || 0,
        suporte_mensagens_nao_lidas: data.suporte_mensagens_nao_lidas || 0,
        promocoes_ativas: data.promocoes_ativas || 0,

        moduleDemandas: manualCounts.novas + manualCounts.negociacao + manualCounts.ativas,
        moduleDemandasAbertas: manualCounts.novas + manualCounts.negociacao,
        moduleDemandasAtivas: manualCounts.ativas,
        moduleAgenda: (data.servicos_ativos || 0) + manualCounts.ativas,
        moduleFinanceiro: data.financeiro_saques_pendentes || 0,
        moduleVouchers: data.vouchers_ativos || 0,
        moduleSuporte: (data.suporte_tickets_ativos || 0) + (data.suporte_mensagens_nao_lidas || 0),
        moduleDocumentos: data.documentos_pendentes || 0,
        modulePremios: data.premios_pendentes || 0,
        modulePromocoes: data.promocoes_ativas || 0,
        
        total: 0
      };

      counts.total = counts.moduleDemandas + counts.moduleAgenda + counts.moduleFinanceiro + 
                     counts.moduleVouchers + counts.moduleSuporte + counts.moduleDocumentos + 
                     counts.modulePremios + counts.modulePromocoes;

      setPendencies(counts);
    } catch (error) {
      console.error('Error fetching provider pendencies:', error);
    }
  }, [prestadorId]);

  const fetchNotifications = useCallback(async () => {
    if (!prestadorId) return;
    try {
      // Obter data de cadastro (cacheado em ref)
      if (!registrationDateRef.current) {
        if (prestador?.created_at) {
          registrationDateRef.current = prestador.created_at;
        } else {
          const { data: p } = await supabase
            .from('prestadores')
            .select('created_at')
            .eq('id', prestadorId)
            .maybeSingle();
          
          if (p?.created_at) {
            registrationDateRef.current = p.created_at;
          } else {
            registrationDateRef.current = new Date().toISOString();
          }
        }
      }

      const regTime = new Date(registrationDateRef.current).getTime();

      const { data: notifs } = await supabase
        .from('notificacoes')
        .select('*')
        .or(`prestador_id.eq.${prestadorId},destinatario_tipo.in.(broadcast_prestadores,broadcast_todos)`)
        .order('data_criacao', { ascending: false })
        .limit(100);

      if (notifs) {
        const normalized = notifs
          .filter(n => {
            // Se for específica do prestador, mostra sempre
            if (n.prestador_id && String(n.prestador_id) === String(prestadorId)) return true;
            
            // Se for broadcast, só mostra se foi criada APÓS o cadastro do prestador
            // Margem de 10 minutos para segurança
            const notifTime = new Date(n.data_criacao).getTime();
            const safetyBuffer = 10 * 60 * 1000;
            return notifTime >= (regTime - safetyBuffer);
          })
          .slice(0, 30)
          .map(n => ({
            id: n.id,
            tipo: n.tipo || 'geral',
            titulo: n.titulo,
            mensagem: n.mensagem,
            lida: n.lida,
            modulo: n.modulo,
            tab: n.tab,
            item_id: n.item_id,
            created_at: n.data_criacao,
            prioridade: n.prioridade || 'normal'
          }));

        setNotifications(normalized);
        setUnreadNotifications(normalized.filter(n => !n.lida).length);
      }
    } catch (e) {
      console.error('Error fetching provider notifications:', e);
    }
  }, [prestadorId]);

  useEffect(() => {
    fetchPrestador();
    fetchPendencies();
    fetchNotifications();

    if (!prestadorId) return;

    let timeoutId: NodeJS.Timeout;
    const debouncedFetch = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        fetchPendencies();
        fetchNotifications();
      }, 300); // Debounce de 300ms (era 10ms - muito agressivo)
    };

    // Subscribe to multiple tables to refresh pendencies
    const tables = [
      'prestador_demandas', 'ordens_servico', 'prestador_transacoes',
      'prestador_vouchers', 'tickets', 'ticket_mensagens', 'prestador_promocoes', 
      'notificacoes', 'prestador_agendamentos', 'prestador_documentos', 'prestadores'
    ];

    const mainChannel = supabase.channel(`provider-updates-${prestadorId}`);

    tables.forEach(table => {
      mainChannel.on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table,
        // Para notificações e tabelas com prestador_id, poderíamos filtrar, 
        // mas por enquanto mantemos genérico para garantir que pegamos tudo que importa
      }, (payload) => {
        console.log(`[Realtime Provider] Alteração em ${table}:`, payload.eventType);
        
        if (payload.eventType === 'INSERT') {
          if (table === 'notificacoes') {
            const n = payload.new as any;
            const isForMe = n.prestador_id && String(n.prestador_id) === String(prestadorId);
            const isBroadcast = ['broadcast_prestadores', 'broadcast_todos'].includes(n.destinatario_tipo);
            
            if (isForMe || isBroadcast) {
              console.log('[Realtime Provider] Nova notificação recebida:', n.titulo);
              playPremiumBeep();
              showAnimatedToast(n.titulo, n.mensagem, n.modulo || 'bell');
              fetchNotifications();
            }
          } else if (table === 'ticket_mensagens') {
            const m = payload.new as any;
            if (m.tipo !== 'prestador') {
              playPremiumBeep();
              fetchNotifications();
            }
          }
        }

        debouncedFetch();
      });
    });

    mainChannel.subscribe((status, err) => {
      console.log('[Realtime Provider] Canal principal status:', status);

      if (status === 'SUBSCRIBED') {
        isSubscribedRef.current = true;
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
        fetchPendencies();
        fetchNotifications();
      }

      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn(`[Realtime Provider] Canal com problema (${status}). Reconectando em ${RECONNECT_DELAY_MS}ms...`, err);
        isSubscribedRef.current = false;
        if (!reconnectTimerRef.current) {
          reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            fetchPendencies();
            fetchNotifications();
          }, RECONNECT_DELAY_MS);
        }
      }

      if (status === 'CLOSED') {
        isSubscribedRef.current = false;
      }
    });

    // Security subscription: Detect if the current provider is deleted or blocked
    const securityChannel = supabase.channel(`provider-security-${prestadorId}`);
    
    securityChannel.on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'prestadores',
      filter: `id=eq.${prestadorId}`
    }, (payload) => {
      if (payload.eventType === 'DELETE') {
        localStorage.clear();
        window.location.href = '/?msg=revoked';
      } else if (payload.eventType === 'UPDATE') {
        if (payload.new.status === 'bloqueado' || payload.new.status === 'inativo') {
          localStorage.clear();
          window.location.href = '/?msg=revoked';
        } else {
          // Atualiza o estado do prestador em tempo real (ex: aprovado)
          setPrestador(payload.new);
        }
      }
    });

    securityChannel.subscribe((status) => {
      console.log('[Realtime Provider] Canal segurança status:', status);
    });

    // Heartbeat: Polling de fallback para garantir dados frescos
    const heartbeatInterval = setInterval(() => {
      if (!isSubscribedRef.current) {
        console.log('[Realtime Provider] Heartbeat detectou desconexão. Fetch manual...');
      }
      fetchPendencies();
      fetchNotifications();
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      clearTimeout(timeoutId);
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      clearInterval(heartbeatInterval);
      isSubscribedRef.current = false;
      supabase.removeChannel(mainChannel);
      supabase.removeChannel(securityChannel);
    };
  }, [prestadorId, fetchPendencies, fetchNotifications]);

  const markAsRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n));
    setUnreadNotifications(prev => Math.max(0, prev - 1));
    await supabase.from('notificacoes').update({ lida: true }).eq('id', id);
  };

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, lida: true })));
    setUnreadNotifications(0);
    await supabase.from('notificacoes').update({ lida: true }).eq('prestador_id', prestadorId);
  };

  const combinedPendencies = React.useMemo(() => {
    const unreadCounts = notifications
      .filter(n => !n.lida)
      .reduce((acc, n) => {
        const mod = n.modulo || '';
        acc[mod] = (acc[mod] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const demandsUnread = notifications.filter(n => !n.lida && (n.modulo === 'demandas' || n.modulo === 'servicos'));
    const unreadAbertas = demandsUnread.filter(n => {
      // Se tiver aba explícita, respeita
      if (n.tab === 'abertas') return true;
      if (n.tab === 'ativas') return false;
      
      // Se não tiver aba, verifica o tipo/título para deduzir
      const isAjuste = n.titulo?.toLowerCase().includes('ajuste') || n.tipo?.includes('ajuste');
      if (isAjuste) return false;

      return !n.tab; // Padrão: vai para abertas se não tiver aba e não for ajuste
    }).length;

    const unreadAtivas = demandsUnread.filter(n => {
      if (n.tab === 'ativas') return true;
      if (n.tab === 'abertas') return false;

      const isAjuste = n.titulo?.toLowerCase().includes('ajuste') || n.tipo?.includes('ajuste');
      return isAjuste;
    }).length;

    const counts = {
      ...pendencies,
      // Mapeia 'servicos' para 'demandas' pois o Admin usa 'servicos' em algumas notificações de demanda
      moduleDemandas: pendencies.moduleDemandas + (unreadCounts['demandas'] || 0) + (unreadCounts['servicos'] || 0),
      moduleDemandasAbertas: pendencies.moduleDemandasAbertas + unreadAbertas,
      moduleDemandasAtivas: pendencies.moduleDemandasAtivas + unreadAtivas,
      moduleAgenda: pendencies.moduleAgenda + (unreadCounts['agenda'] || 0),
      moduleFinanceiro: pendencies.moduleFinanceiro + (unreadCounts['financeiro'] || 0),
      moduleVouchers: pendencies.moduleVouchers + (unreadCounts['vouchers'] || 0),
      moduleSuporte: pendencies.moduleSuporte + (unreadCounts['suporte'] || 0),
      moduleDocumentos: pendencies.moduleDocumentos + (unreadCounts['documentos'] || 0),
      modulePremios: pendencies.modulePremios + (unreadCounts['premios'] || 0),
      modulePromocoes: pendencies.modulePromocoes + (unreadCounts['promocoes'] || 0),
      promocoes_ativas: pendencies.promocoes_ativas + (unreadCounts['promocoes'] || 0)
    };

    counts.total = counts.moduleDemandas + counts.moduleAgenda + counts.moduleFinanceiro + 
                  counts.moduleVouchers + counts.moduleSuporte + counts.moduleDocumentos + 
                  counts.modulePremios + counts.modulePromocoes;

    return counts;
  }, [pendencies, notifications]);

  return (
    <ProviderNotificationContext.Provider value={{ 
      pendencies: combinedPendencies, 
      notifications, 
      unreadNotifications,
      prestador,
      loading,
      markAsRead,
      markAllAsRead,
      refreshCounts: async () => {
        await Promise.all([fetchPrestador(), fetchPendencies(), fetchNotifications()]);
      } 
    }}>
      {children}
    </ProviderNotificationContext.Provider>
  );
}

export function useProviderNotifications() {
  const context = useContext(ProviderNotificationContext);
  if (context === undefined) {
    throw new Error('useProviderNotifications must be used within a ProviderNotificationProvider');
  }
  return context;
}
