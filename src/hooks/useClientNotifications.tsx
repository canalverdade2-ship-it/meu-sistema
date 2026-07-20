import React, { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import { supabase } from '../lib/supabase';
import { playPremiumBeep } from '../lib/utils';
import { showAnimatedToast } from '../lib/notifications';

// Constantes de reconexão
const HEARTBEAT_INTERVAL_MS = 30000; // 30s polling de fallback
const RECONNECT_DELAY_MS = 3000;     // 3s delay para reconexão

export interface ClientPendencyCounts {
  financeiro_faturas_pendentes: number;
  financeiro_faturas_vencidas: number;
  financeiro_saques_analise: number;
  orcamentos_abertos: number;
  servicos_andamento: number;
  vouchers_ativos: number;
  suporte_tickets_ativos: number;
  suporte_mensagens_nao_lidas: number;
  indicacoes_abertas: number;
  produtos_analise: number;
  assinaturas_analise: number;
  documentos_pendentes: number;
  emprestimos_acoes_necessarias: number;
  emprestimos_parcelas_vencidas: number;

  // Module Totals (for sidebar)
  moduleFinanceiro: number;
  moduleServicos: number;
  moduleOrcamentos: number;
  moduleSuporte: number;
  moduleVouchers: number;
  moduleIndiqueGanhe: number;
  moduleProdutos: number;
  moduleAssinaturas: number;
  modulePromocoes: number;
  modulePerfil: number;
  moduleEmprestimos: number;
  
  // Overall Total
  total: number;
}

const defaultCounts: ClientPendencyCounts = {
  financeiro_faturas_pendentes: 0,
  financeiro_faturas_vencidas: 0,
  financeiro_saques_analise: 0,
  orcamentos_abertos: 0,
  servicos_andamento: 0,
  vouchers_ativos: 0,
  suporte_tickets_ativos: 0,
  suporte_mensagens_nao_lidas: 0,
  indicacoes_abertas: 0,
  produtos_analise: 0,
  assinaturas_analise: 0,
  documentos_pendentes: 0,
  moduleFinanceiro: 0,
  moduleServicos: 0,
  moduleOrcamentos: 0,
  moduleSuporte: 0,
  moduleVouchers: 0,
  moduleIndiqueGanhe: 0,
  moduleProdutos: 0,
  moduleAssinaturas: 0,
  modulePromocoes: 0,
  modulePerfil: 0,
  moduleEmprestimos: 0,
  emprestimos_acoes_necessarias: 0,
  emprestimos_parcelas_vencidas: 0,
  total: 0
};

interface ClientNotificacao {
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

interface ClientNotificationContextType {
  pendencies: ClientPendencyCounts;
  notifications: ClientNotificacao[];
  unreadNotifications: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refreshCounts: () => Promise<void>;
}

const ClientNotificationContext = createContext<ClientNotificationContextType | undefined>(undefined);

export function ClientNotificationProvider({ children, clientId }: { children: React.ReactNode, clientId: string }) {
  const [pendencies, setPendencies] = useState<ClientPendencyCounts>(defaultCounts);
  const [notifications, setNotifications] = useState<ClientNotificacao[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const registrationDateRef = useRef<string | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSubscribedRef = useRef(false);

  const fetchPendencies = useCallback(async () => {
    if (!clientId) return;

    try {
      const { data, error } = await supabase.rpc('get_client_pendency_counts', { p_cliente_id: clientId });
      if (error) throw error;

      // Realizar contagens diretas para garantir máxima precisão
      const { count: realOrcamentosCount } = await supabase
        .from('orcamentos')
        .select('*', { count: 'exact', head: true })
        .eq('cliente_id', clientId)
        .in('status', ['aberto', 'pendente', 'negociação', 'em revisão', 'pendência documentos']);

      // Promoções precisam ser calculadas à parte por causa da lógica de data dinâmica
      const now = new Date().toISOString();
      const [promocoesAtivas, minhasPromosAtivadas] = await Promise.all([
        supabase.from('promocoes').select('id').eq('status', 'ativa').lte('data_inicio_divulgacao', now).gte('data_fim_divulgacao', now),
        supabase.from('cliente_promocoes').select('promocao_id').eq('cliente_id', clientId)
      ]);

      const allActivePromos = (promocoesAtivas?.data || []) as {id: string}[];
      const activatedPromoIds = ((minhasPromosAtivadas?.data || []) as {promocao_id: string}[]).map(p => p.promocao_id);
      const promocoesDisponiveisCount = allActivePromos.filter(p => !activatedPromoIds.includes(p.id)).length;

      const orcamentos_abertos = realOrcamentosCount || 0;

      const counts: ClientPendencyCounts = {
        financeiro_faturas_pendentes: data.financeiro_faturas_pendentes || 0,
        financeiro_faturas_vencidas: data.financeiro_faturas_vencidas || 0,
        financeiro_saques_analise: data.financeiro_saques_analise || 0,
        orcamentos_abertos: orcamentos_abertos,
        servicos_andamento: data.servicos_andamento || 0,
        vouchers_ativos: data.vouchers_ativos || 0,
        suporte_tickets_ativos: data.suporte_tickets_ativos || 0,
        suporte_mensagens_nao_lidas: data.suporte_mensagens_nao_lidas || 0,
        indicacoes_abertas: data.indicacoes_abertas || 0,
        produtos_analise: data.produtos_analise || 0,
        assinaturas_analise: data.assinaturas_analise || 0,
        documentos_pendentes: data.documentos_pendentes || 0,
        emprestimos_acoes_necessarias: data.emprestimos_acoes_necessarias || 0,
        emprestimos_parcelas_vencidas: data.emprestimos_parcelas_vencidas || 0,

        moduleFinanceiro: (data.financeiro_faturas_pendentes || 0) + (data.financeiro_faturas_vencidas || 0) + (data.financeiro_saques_analise || 0),
        moduleServicos: data.servicos_andamento || 0,
        moduleOrcamentos: orcamentos_abertos,
        moduleSuporte: (data.suporte_tickets_ativos || 0) + (data.suporte_mensagens_nao_lidas || 0),
        moduleVouchers: data.vouchers_ativos || 0,
        moduleIndiqueGanhe: data.indicacoes_abertas || 0,
        moduleProdutos: data.produtos_analise || 0,
        moduleAssinaturas: data.assinaturas_analise || 0,
        modulePromocoes: promocoesDisponiveisCount,
        modulePerfil: data.documentos_pendentes || 0,
        moduleEmprestimos: (data.emprestimos_acoes_necessarias || 0) + (data.emprestimos_parcelas_vencidas || 0),
        
        total: 0
      };

      counts.total = counts.moduleFinanceiro + counts.moduleServicos + counts.moduleOrcamentos + 
                     counts.moduleSuporte + counts.moduleVouchers + counts.moduleIndiqueGanhe + 
                     counts.moduleProdutos + counts.moduleAssinaturas + counts.modulePromocoes + 
                     counts.modulePerfil + counts.moduleEmprestimos;

      setPendencies(counts);
    } catch (error) {
      console.error('Error fetching client pendencies RPC:', error);
    }
  }, [clientId]);

  const fetchNotifications = useCallback(async () => {
    if (!clientId) return;
    try {
      // 1. Obter data de cadastro para filtrar broadcasts (cacheado em ref)
      if (!registrationDateRef.current) {
        const { data: client } = await supabase
          .from('clientes')
          .select('data_cadastro')
          .eq('id', clientId)
          .maybeSingle();
        
        registrationDateRef.current = client?.data_cadastro || new Date().toISOString();
      }

      const regTime = new Date(registrationDateRef.current).getTime();
      const safetyBuffer = 10 * 60 * 1000; // 10 min de margem

      // 2. Buscar notificações (Nominais + Broadcasts)
      const { data: notifs, error } = await supabase
        .from('notificacoes')
        .select('*')
        .or(`cliente_id.eq.${clientId},destinatario_tipo.in.(broadcast_clientes,broadcast_todos)`)
        .order('data_criacao', { ascending: false })
        .limit(50);

      if (error) throw error;

      if (notifs) {
        const normalized = notifs
          .filter(n => {
            // Regra: Notificação nominal ao cliente SEMPRE aparece
            if (n.cliente_id && String(n.cliente_id) === String(clientId)) return true;
            
            // Regra: Broadcast só aparece se for criado APÓS (ou quase junto) o cadastro do cliente
            const notifTime = new Date(n.data_criacao).getTime();
            return notifTime >= (regTime - safetyBuffer);
          })
          .slice(0, 30)
          .map(n => ({
            id: n.id,
            tipo: n.tipo || 'sistema',
            titulo: n.titulo,
            mensagem: n.mensagem,
            lida: !!n.lida,
            modulo: n.modulo || 'bell',
            tab: n.tab,
            item_id: n.item_id,
            created_at: n.data_criacao,
            prioridade: n.prioridade || 'normal'
          }));

        setNotifications(normalized);
        setUnreadNotifications(normalized.filter(n => !n.lida).length);
      }
    } catch (e) {
      console.error('[useClientNotifications] Erro ao buscar notificações:', e);
    }
  }, [clientId]);

  useEffect(() => {
    fetchPendencies();
    fetchNotifications();

    if (!clientId) return;

    let timeoutId: NodeJS.Timeout;
    const debouncedFetch = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        fetchNotifications();
        fetchPendencies();
      }, 300); // Debounce de 300ms mais amigável
    };

    // Canal unificado para atualizações do cliente (contadores e notificações)
    const channel = supabase.channel(`notif-client-${clientId}`);

    const tables = [
      'faturas', 'saques', 'orcamentos', 'ordens_servico', 
      'vouchers', 'tickets', 'ticket_mensagens', 'indicacoes',
      'cliente_documentos', 'notificacoes', 'emprestimos', 
      'emprestimo_parcelas', 'promocoes', 'produtos', 'servicos', 
      'assinaturas', 'cupons_loja', 'loja_credito_solicitacoes', 'loja_credito_documentos'
    ];

    tables.forEach(table => {
      channel.on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table 
      }, (payload) => {
        // Log para debug (pode ser removido depois)
        console.log(`[Realtime] Mudança em ${table}:`, payload.eventType);

        if (payload.eventType === 'INSERT') {
          if (table === 'ticket_mensagens') {
            const m = payload.new as any;
            if (m.tipo !== 'cliente') {
              playPremiumBeep();
              fetchNotifications();
            }
          }
        }
        
        // Atualiza contadores em qualquer mudança relevante (INSERT, UPDATE, DELETE)
        debouncedFetch();
      });
    });

    channel.subscribe((status, err) => {
      console.log(`[Realtime Client] Canal ${clientId} status:`, status);
      
      if (status === 'SUBSCRIBED') {
        isSubscribedRef.current = true;
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
        // Buscar dados frescos ao reconectar
        fetchNotifications();
        fetchPendencies();
      }
      
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn(`[Realtime Client] Canal com problema (${status}). Reconectando em ${RECONNECT_DELAY_MS}ms...`, err);
        isSubscribedRef.current = false;
        
        if (!reconnectTimerRef.current) {
          reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            console.log('[Realtime Client] Tentando reconexão...');
            fetchNotifications();
            fetchPendencies();
          }, RECONNECT_DELAY_MS);
        }
      }
      
      if (status === 'CLOSED') {
        isSubscribedRef.current = false;
      }
    });

    // Canal dedicado APENAS para notificações (evita limite de bindings do Supabase)
    const notifChannel = supabase.channel(`notif-direct-${clientId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificacoes' }, (payload) => {
        const n = payload.new as any;
        const isForMe = n.cliente_id && String(n.cliente_id) === String(clientId);
        const isBroadcast = ['broadcast_clientes', 'broadcast_todos'].includes(n.destinatario_tipo);
        
        if (isForMe || isBroadcast) {
          console.log('[Realtime Client] Nova notificação recebida:', n.titulo);
          playPremiumBeep();
          showAnimatedToast(n.titulo, n.mensagem, n.modulo || 'bell');
          fetchNotifications();
        }
      })
      .subscribe();

    // Security subscription: Detect if the current client is deleted or blocked
    const securityChannel = supabase.channel(`client-security-${clientId}`);
    
    securityChannel.on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'clientes',
      filter: `id=eq.${clientId}`
    }, (payload) => {
      if (payload.eventType === 'DELETE') {
        localStorage.clear();
        window.location.href = '/?msg=revoked';
      } else if (payload.eventType === 'UPDATE' && (payload.new.status === 'bloqueado' || payload.new.status === 'inativo')) {
        localStorage.clear();
        window.location.href = '/?msg=revoked';
      }
    });

    securityChannel.subscribe((status) => {
      console.log(`[Realtime Client] Canal segurança status:`, status);
    });

    // Heartbeat: Polling de fallback para garantir dados frescos
    const heartbeatInterval = setInterval(() => {
      if (!isSubscribedRef.current) {
        console.log('[Realtime Client] Heartbeat detectou desconexão. Fetch manual...');
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
      supabase.removeChannel(channel);
      supabase.removeChannel(securityChannel);
      supabase.removeChannel(notifChannel);
    };
  }, [clientId, fetchPendencies, fetchNotifications]);

  const markAsRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n));
    setUnreadNotifications(prev => Math.max(0, prev - 1));
    await supabase.from('notificacoes').update({ lida: true }).eq('id', id);
  };

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, lida: true })));
    setUnreadNotifications(0);
    await supabase.from('notificacoes').update({ lida: true }).eq('cliente_id', clientId);
  };

  return (
    <ClientNotificationContext.Provider value={{ 
      pendencies, 
      notifications, 
      unreadNotifications,
      markAsRead,
      markAllAsRead,
      refreshCounts: fetchPendencies 
    }}>
      {children}
    </ClientNotificationContext.Provider>
  );
}

export function useClientNotifications() {
  const context = useContext(ClientNotificationContext);
  if (context === undefined) {
    throw new Error('useClientNotifications must be used within a ClientNotificationProvider');
  }
  return context;
}
