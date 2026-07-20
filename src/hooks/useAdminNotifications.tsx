import React, { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';

// Constantes de reconexão
const HEARTBEAT_INTERVAL_MS = 30000; // 30s polling de fallback
const RECONNECT_DELAY_MS = 3000;     // 3s delay para reconexão

export interface PendencyCounts {
  // Cadastro
  cadastro_clientes_inativos: number;
  cadastro_clientes_bloqueados: number;
  cadastro_clientes_pendentes: number;
  cadastro_prestadores_pendentes: number;
  cadastro_prestadores_analise: number;
  cadastro_documentos_pendentes: number;
  cadastro_cliente_documentos_analise: number;
  cadastro_vouchers_pendentes: number;
  cadastro_premios_pendentes: number;
  
  // Cobrancas
  cobrancas_pendentes: number;
  cobrancas_criticas: number;

  // Financeiro
  financeiro_faturas_vencidas: number;
  financeiro_faturas_pendentes: number;
  financeiro_saques_pendentes: number;
  financeiro_transferencias_analise: number;
  financeiro_prestador_saques_pendentes: number;
  
  // Vendas
  vendas_orcamentos_pendentes: number;
  vendas_orcamentos_aprovados: number;
  vendas_demandas_abertas: number;
  vendas_demandas_prestador: number;
  vendas_demandas_internas: number;
  vendas_demandas_ativas: number;
  vendas_demandas_suporte: number;
  vendas_os_andamento: number;
  vendas_emprestimos_pendentes: number;
  vendas_credito_pendentes: number;
  vendas_assinaturas_pendentes: number;
  
  // Suporte
  suporte_tickets_abertos: number;
  suporte_tickets_em_andamento: number;
  suporte_mensagens_nao_lidas: number;
  
  // Administrativo / Acessos
  acessos_exclusoes_pendentes: number;
  
  // Fiscal
  fiscal_pendencias: number;

  // Totals by Module
  moduleCadastro: number;
  moduleVendas: number;
  moduleFinanceiro: number;
  moduleCobranca: number;
  moduleFiscal: number;
  moduleSuporte: number;
  moduleAcessos: number;
  moduleDemandas: number;

  // Totals
  total: number;
}

const defaultCounts: PendencyCounts = {
  cadastro_clientes_inativos: 0,
  cadastro_clientes_bloqueados: 0,
  cadastro_clientes_pendentes: 0,
  cadastro_prestadores_pendentes: 0,
  cadastro_prestadores_analise: 0,
  cadastro_documentos_pendentes: 0,
  cadastro_cliente_documentos_analise: 0,
  cadastro_vouchers_pendentes: 0,
  cadastro_premios_pendentes: 0,
  cobrancas_pendentes: 0,
  cobrancas_criticas: 0,
  financeiro_faturas_vencidas: 0,
  financeiro_faturas_pendentes: 0,
  financeiro_saques_pendentes: 0,
  financeiro_transferencias_analise: 0,
  financeiro_prestador_saques_pendentes: 0,
  vendas_orcamentos_pendentes: 0,
  vendas_orcamentos_aprovados: 0,
  vendas_demandas_abertas: 0,
  vendas_demandas_prestador: 0,
  vendas_demandas_internas: 0,
  vendas_demandas_ativas: 0,
  vendas_demandas_suporte: 0,
  vendas_os_andamento: 0,
  vendas_emprestimos_pendentes: 0,
  vendas_credito_pendentes: 0,
  vendas_assinaturas_pendentes: 0,
  suporte_tickets_abertos: 0,
  suporte_tickets_em_andamento: 0,
  suporte_mensagens_nao_lidas: 0,
  acessos_exclusoes_pendentes: 0,
  fiscal_pendencias: 0,
  
  moduleCadastro: 0,
  moduleVendas: 0,
  moduleFinanceiro: 0,
  moduleCobranca: 0,
  moduleFiscal: 0,
  moduleSuporte: 0,
  moduleAcessos: 0,
  moduleDemandas: 0,
  total: 0
};

export interface AdminNotificacao {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  lida: boolean;
  modulo?: string;
  tab?: string;
  item_id?: string;
  link?: string;
  created_at: string;
  is_admin_table?: boolean;
  prioridade?: string;
  acao_origem?: string;
  destinatario_tipo?: string;
}

interface AdminNotificationContextType {
  pendencies: PendencyCounts;
  notifications: AdminNotificacao[];
  unreadNotifications: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteAllNotifications: () => Promise<void>;
  refreshCounts: () => Promise<void>;
}

const AdminNotificationContext = createContext<AdminNotificationContextType | undefined>(undefined);

// Função para tocar som de notificação (Beep Premium)
const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // Mi 5
    oscillator.frequency.exponentialRampToValueAtTime(440, audioContext.currentTime + 0.1); // La 4
    
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (e) {
    console.warn('Áudio não suportado ou bloqueado pelo navegador:', e);
  }
};

export function AdminNotificationProvider({ children }: { children: React.ReactNode }) {
  const [pendencies, setPendencies] = useState<PendencyCounts>(defaultCounts);
  const [notifications, setNotifications] = useState<AdminNotificacao[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSubscribedRef = useRef(false);

  const fetchPendencies = useCallback(async () => {
    // Evitar chamadas se a aba não estiver visível para economizar recursos e evitar timeouts
    if (document.visibilityState !== 'visible') return;

    try {
      const { data, error } = await supabase.rpc('get_admin_pendency_counts');
      if (error) throw error;

      // Busca separada das assinaturas pendentes, já que o RPC não as retorna
      const { count: assCount } = await supabase
        .from('ordens_assinatura')
        .select('*', { count: 'exact', head: true })
        .in('status', ['em_analise', 'pendente', 'pago']);

      const counts = {
        cadastro_clientes_inativos: data.cadastro_clientes_inativos || 0,
        cadastro_clientes_bloqueados: data.cadastro_clientes_bloqueados || 0,
        cadastro_clientes_pendentes: data.cadastro_clientes_pendentes || 0,
        cadastro_prestadores_pendentes: data.cadastro_prestadores_pendentes || 0,
        cadastro_prestadores_analise: data.cadastro_prestadores_analise || 0,
        cadastro_documentos_pendentes: data.cadastro_docs_pendentes || 0,
        cadastro_cliente_documentos_analise: data.cadastro_cliente_docs_pendentes || 0,
        cadastro_vouchers_pendentes: data.cadastro_vouchers_pendentes || 0,
        cadastro_premios_pendentes: data.cadastro_premios_pendentes || 0,
        cobrancas_pendentes: data.cobranca_pendentes || 0,
        cobrancas_criticas: data.cobranca_criticas || 0,
        financeiro_faturas_vencidas: data.financeiro_faturas_vencidas || 0,
        financeiro_faturas_pendentes: data.financeiro_faturas_pendentes || 0,
        financeiro_saques_pendentes: data.financeiro_saques_pendentes || 0,
        financeiro_transferencias_analise: data.financeiro_transferencias_analise || 0,
        financeiro_prestador_saques_pendentes: data.financeiro_prestador_saques || 0,
        vendas_orcamentos_pendentes: data.vendas_orcamentos_pendentes || 0,
        vendas_orcamentos_aprovados: data.vendas_orcamentos_aprovados || 0,
        vendas_demandas_abertas: data.vendas_demandas_abertas || 0,
        vendas_demandas_prestador: data.vendas_demandas_prestador || 0,
        vendas_demandas_internas: data.vendas_demandas_internas || 0,
        vendas_demandas_ativas: (data.vendas_demandas_prestador || 0) + (data.vendas_demandas_internas || 0),
        vendas_demandas_suporte: data.vendas_demandas_suporte || 0,
        vendas_os_andamento: data.vendas_os_andamento || 0,
        vendas_emprestimos_pendentes: data.vendas_emprestimos_pendentes || 0,
        vendas_credito_pendentes: data.vendas_credito_pendentes || 0,
        vendas_assinaturas_pendentes: assCount || 0,
        suporte_tickets_abertos: data.suporte_tickets_abertos || 0,
        suporte_tickets_em_andamento: data.suporte_tickets_em_andamento || 0,
        suporte_mensagens_nao_lidas: data.suporte_mensagens_nao_lidas || 0,
        acessos_exclusoes_pendentes: data.acessos_exclusao_pendentes || 0,
        fiscal_pendencias: data.fiscal_pendentes || 0
      };

      const moduleCadastro = 
        counts.cadastro_clientes_inativos + 
        counts.cadastro_clientes_bloqueados + 
        counts.cadastro_clientes_pendentes + 
        counts.cadastro_prestadores_pendentes + 
        counts.cadastro_prestadores_analise + 
        counts.cadastro_documentos_pendentes +
        counts.cadastro_cliente_documentos_analise +
        counts.cadastro_vouchers_pendentes +
        counts.cadastro_premios_pendentes;

      const moduleCobranca = 
        counts.cobrancas_pendentes + counts.cobrancas_criticas;

      const moduleFinanceiro = 
        counts.financeiro_faturas_vencidas + 
        counts.financeiro_faturas_pendentes + 
        counts.financeiro_saques_pendentes + 
        counts.financeiro_transferencias_analise + 
        counts.financeiro_prestador_saques_pendentes;

      const moduleVendas = 
        counts.vendas_orcamentos_pendentes + 
        counts.vendas_orcamentos_aprovados +
        counts.vendas_demandas_abertas + 
        counts.vendas_demandas_ativas + 
        counts.vendas_demandas_suporte +
        counts.vendas_os_andamento +
        counts.vendas_credito_pendentes +
        counts.vendas_assinaturas_pendentes;

      const moduleSuporte = 
        counts.suporte_tickets_abertos + 
        (counts.suporte_mensagens_nao_lidas > 0 ? counts.suporte_mensagens_nao_lidas : counts.suporte_tickets_em_andamento);

      const moduleAcessos = 
        counts.acessos_exclusoes_pendentes;

      const moduleDemandas = 
        counts.vendas_demandas_internas;

      const moduleFiscal = 
        counts.fiscal_pendencias;

      const total = moduleCadastro + moduleFinanceiro + moduleCobranca + moduleVendas + moduleSuporte + moduleAcessos + moduleDemandas + moduleFiscal;

      setPendencies({
        ...counts,
        moduleCadastro,
        moduleFinanceiro,
        moduleCobranca,
        moduleVendas,
        moduleFiscal,
        moduleSuporte,
        moduleAcessos,
        moduleDemandas,
        total
      });

    } catch (e) {
      console.error('Erro ao buscar pendências RPC:', e);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    // Evitar chamadas se a aba não estiver visível
    if (document.visibilityState !== 'visible') return;

    try {
      const storedAdminType = localStorage.getItem('adminType');
      const colabId = localStorage.getItem('colaboradorId');
      // A tabela legada é exclusiva da Gestão. Colaboradores usam notificações direcionadas.
      const adminResult = storedAdminType === 'colaborador'
        ? { data: [] as any[], error: null }
        : await supabase.from('admin_notificacoes').select('*').order('created_at', { ascending: false }).limit(30);
      const { data: adminNotifs, error: adminError } = adminResult;

      // Busca notificações destinadas ao ator atual.
      
      let query = supabase
        .from('notificacoes')
        .select('id, titulo, mensagem, modulo, tab, item_id, lida, data_criacao, tipo, prioridade, acao_origem, destinatario_tipo, colaborador_id')
        .order('data_criacao', { ascending: false })
        .limit(40);

      if (colabId) {
        query = query.or(`destinatario_tipo.eq.broadcast_todos,and(destinatario_tipo.eq.colaborador,colaborador_id.eq.${colabId})`);
      } else {
        query = query.in('destinatario_tipo', ['admin', 'broadcast_todos']);
      }

      const { data: generalNotifs, error: generalError } = await query;
      let collaboratorReceipts: any[] = [];
      if (colabId && generalNotifs?.length) {
        const { data: receipts, error: receiptError } = await supabase
          .from('notificacao_leituras_colaborador')
          .select('notificacao_id, lida, ocultada')
          .eq('colaborador_id', colabId)
          .in('notificacao_id', generalNotifs.map((notification: any) => notification.id));
        if (receiptError && receiptError.code !== '42P01') console.error('Error fetching collaborator notification receipts:', receiptError);
        collaboratorReceipts = receipts || [];
      }

      if (adminError && adminError.code !== '42P01') console.error('Error fetching admin notifications:', adminError);
      if (generalError && generalError.code !== '42P01') console.error('Error fetching general notifications:', generalError);

      // Unificar e normalizar
      const unified: AdminNotificacao[] = [
        ...(adminNotifs || []).map(n => ({
          ...n,
          id: `admin_${n.id}`, // Prefixo para garantir unicidade global
          is_admin_table: true
        })),
        ...(generalNotifs || []).filter((n: any) => {
          const receipt = collaboratorReceipts.find((item: any) => item.notificacao_id === n.id);
          return !receipt?.ocultada;
        }).map((n: any) => {
          const receipt = collaboratorReceipts.find((item: any) => item.notificacao_id === n.id);
          return {
            id: `gen_${n.id}`,
            titulo: n.titulo,
            mensagem: n.mensagem,
            modulo: n.modulo,
            tab: n.tab,
            item_id: n.item_id,
            lida: colabId ? Boolean(receipt?.lida) : n.lida,
            created_at: n.data_criacao,
            tipo: n.tipo || 'geral',
            link: n.item_id ? `/${n.modulo}/${n.item_id}` : undefined,
            is_admin_table: false,
            prioridade: n.prioridade || 'normal',
            acao_origem: n.acao_origem,
            destinatario_tipo: n.destinatario_tipo
          };
        })
      ];

      // Ordenar por data decrescente
      unified.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setNotifications(unified.slice(0, 50));
      setUnreadNotifications(unified.filter(n => !n.lida).length);
    } catch (e) {
      console.error('Error in fetchNotifications:', e);
    }
  }, []);

  useEffect(() => {
    fetchPendencies();
    fetchNotifications();

    let timeoutId: NodeJS.Timeout;
    const debouncedFetch = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (document.visibilityState === 'visible') {
          fetchPendencies();
          fetchNotifications();
        }
      }, 1000); // Debounce aumentado para 1s para reduzir carga no banco
    };

    // Subscribe to multiple tables to refresh pendencies
    const tables = [
      'prestador_demandas', 'prestador_documentos', 'cliente_documentos', 
      'tickets', 'solicitacoes_exclusao', 'prestadores', 'orcamentos', 
      'faturas', 'cobrancas', 'saques', 'transferencias', 'ordens_servico', 
      'ordens_compra', 'ordens_assinatura', 'ticket_mensagens', 'clientes', 
      'prestador_saques', 'vouchers', 'cliente_premios', 'ordens_fiscais',
      'loja_credito_solicitacoes', 'loja_credito_documentos'
    ];

    const mainChannel = supabase.channel('admin-all-updates');

    tables.forEach(table => {
      mainChannel.on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
        debouncedFetch();
        
        // Tocar som em novos itens importantes — apenas se o colaborador tiver acesso ao módulo
        if (payload.eventType === 'INSERT') {
          const adminType = localStorage.getItem('adminType');
          const colabModulos = JSON.parse(localStorage.getItem('colaboradorModulos') || '[]');
          
          const tableToModule: Record<string, string> = {
            'tickets': 'tickets',
            'ticket_mensagens': 'tickets',
            'saques': 'financeiro',
            'prestador_saques': 'financeiro',
            'transferencias': 'financeiro',
            'faturas': 'financeiro',
            'solicitacoes_exclusao': 'acessos',
            'prestadores': 'prestadores',
            'clientes': 'cadastro',
            'prestador_documentos': 'prestadores',
            'cliente_documentos': 'cadastro',
            'orcamentos': 'vendas',
            'ordens_servico': 'vendas',
            'prestador_demandas': 'demandas',
            'loja_credito_solicitacoes': 'vendas',
            'loja_credito_documentos': 'vendas'
          };

          const module = tableToModule[table];
          const hasAccess = adminType === 'admin' || (module && colabModulos.includes(module)) || table === 'prestador_demandas';

          const highPriority = ['tickets', 'saques', 'transferencias', 'solicitacoes_exclusao', 'prestadores', 'clientes', 'prestador_demandas'];
          if (hasAccess && highPriority.includes(table)) {
            playNotificationSound();
          }
        }
      });
    });

    mainChannel.subscribe((status, err) => {
      console.log('[Realtime Admin] Canal principal status:', status);

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
        console.warn(`[Realtime Admin] Canal com problema (${status}). Reconectando em ${RECONNECT_DELAY_MS}ms...`, err);
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

    const handleNewInsert = (payload: any, isAdminTable: boolean) => {
      const raw = payload.new;

      // Filtrar: só aceitar notificações destinadas ao admin ou ao colaborador específico
      const adminType = localStorage.getItem('adminType');
      const colabId = localStorage.getItem('colaboradorId');
      if (isAdminTable && adminType === 'colaborador') return;

      if (!isAdminTable) {
        if (raw.destinatario_tipo === 'colaborador' && raw.colaborador_id !== colabId) return;
        if (raw.destinatario_tipo && !['admin', 'broadcast_todos', 'colaborador'].includes(raw.destinatario_tipo)) {
          return; // Ignora notificações destinadas a clientes/prestadores
        }
      }

      const prioridadeColor = raw.prioridade === 'urgente' ? 'bg-red-500' : raw.prioridade === 'alta' ? 'bg-orange-500' : isAdminTable ? 'bg-indigo-500' : 'bg-amber-500';

      const nova: AdminNotificacao = isAdminTable ? { ...raw as AdminNotificacao, id: `admin_${raw.id}`, is_admin_table: true } : {
        id: `gen_${raw.id}`,
        titulo: raw.titulo,
        mensagem: raw.mensagem,
        modulo: raw.modulo,
        tab: raw.tab,
        item_id: raw.item_id,
        lida: raw.lida,
        created_at: raw.data_criacao,
        tipo: raw.tipo || 'geral',
        is_admin_table: false,
        prioridade: raw.prioridade || 'normal',
        acao_origem: raw.acao_origem,
        destinatario_tipo: raw.destinatario_tipo
      };

      setNotifications(prev => [nova, ...prev.slice(0, 49)]);
      setUnreadNotifications(prev => prev + 1);
      playNotificationSound();
      
      // Exibir toast em real-time com indicador de prioridade
      toast.custom((t) => (
        <div className={`bg-white px-6 py-4 shadow-xl ring-1 ring-black/5 rounded-2xl flex gap-4 max-w-sm ${t.visible ? 'animate-enter' : 'animate-leave'}`}>
          <div className={`mt-1 h-2.5 w-2.5 rounded-full flex-shrink-0 ${prioridadeColor}`} />
          <div>
            <p className="font-bold text-sm text-neutral-900">{nova.titulo}</p>
            <p className="mt-1 text-sm text-neutral-500 line-clamp-2">{nova.mensagem}</p>
          </div>
        </div>
      ), { duration: 5000, position: 'top-right' });
    };

    // Subscriptions for both notification tables
    const adminNotifSub = supabase.channel('admin-notifs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_notificacoes' }, (p) => handleNewInsert(p, true))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'admin_notificacoes' }, fetchNotifications)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'admin_notificacoes' }, fetchNotifications)
      .subscribe();

    const generalNotifSub = supabase.channel('general-notifs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificacoes' }, (p) => handleNewInsert(p, false))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notificacoes' }, fetchNotifications)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notificacoes' }, fetchNotifications)
      .subscribe();

    // Security subscription: Detect if the current admin/colaborador is deleted or blocked
    const colabId = localStorage.getItem('colaboradorId');
    let securitySub: any = null;

    if (colabId) {
      securitySub = supabase.channel(`admin-security-${colabId}`)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'colaboradores',
          filter: `id=eq.${colabId}`
        }, (payload) => {
          if (payload.eventType === 'DELETE') {
            localStorage.clear();
            window.location.href = '/?msg=revoked';
          } else if (payload.eventType === 'UPDATE' && (payload.new.status === 'bloqueado' || payload.new.status === 'inativo')) {
            localStorage.clear();
            window.location.href = '/?msg=revoked';
          }
        })
        .subscribe();
    }

    // Polling de fallback: Só executa se a aba estiver visível e a conexão realtime estiver com problemas
    const heartbeatInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        if (!isSubscribedRef.current) {
          console.log('[Realtime Admin] Heartbeat detectou desconexão. Fetch manual...');
        }
        fetchPendencies();
        fetchNotifications();
      }
    }, HEARTBEAT_INTERVAL_MS);

    // Refresh ao voltar para a aba
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchPendencies();
        fetchNotifications();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearTimeout(timeoutId);
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      clearInterval(heartbeatInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      isSubscribedRef.current = false;
      supabase.removeChannel(mainChannel);
      supabase.removeChannel(adminNotifSub);
      supabase.removeChannel(generalNotifSub);
      if (securitySub) supabase.removeChannel(securitySub);
    };
  }, [fetchPendencies, fetchNotifications]);

  const markAsRead = async (id: string) => {
    const notif = notifications.find(n => n.id === id);
    if (!notif) return;
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n));
    setUnreadNotifications(prev => Math.max(0, prev - 1));

    const originalId = id.split('_')[1] || id;
    const colabId = localStorage.getItem('colaboradorId');
    const adminType = localStorage.getItem('adminType');
    if (adminType === 'colaborador' && colabId && !(notif as any).is_admin_table) {
      await supabase.from('notificacao_leituras_colaborador').upsert({ notificacao_id: originalId, colaborador_id: colabId, lida: true, ocultada: false, atualizado_em: new Date().toISOString() });
      return;
    }
    const table = (notif as any).is_admin_table ? 'admin_notificacoes' : 'notificacoes';
    await supabase.from(table).update({ lida: true }).eq('id', originalId);
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.lida);
    if (unread.length === 0) return;
    setNotifications(prev => prev.map(n => ({ ...n, lida: true })));
    setUnreadNotifications(0);

    const colabId = localStorage.getItem('colaboradorId');
    const adminType = localStorage.getItem('adminType');
    if (adminType === 'colaborador' && colabId) {
      const receipts = unread.filter((n: any) => !n.is_admin_table).map(n => ({ notificacao_id: n.id.split('_')[1] || n.id, colaborador_id: colabId, lida: true, ocultada: false, atualizado_em: new Date().toISOString() }));
      if (receipts.length) await supabase.from('notificacao_leituras_colaborador').upsert(receipts);
      return;
    }
    const adminIds = unread.filter((n: any) => n.is_admin_table).map(n => n.id.split('_')[1] || n.id);
    const generalIds = unread.filter((n: any) => !n.is_admin_table).map(n => n.id.split('_')[1] || n.id);
    if (adminIds.length) await supabase.from('admin_notificacoes').update({ lida: true }).in('id', adminIds);
    if (generalIds.length) await supabase.from('notificacoes').update({ lida: true }).in('id', generalIds);
  };

  const deleteAllNotifications = async () => {
    if (notifications.length === 0) return;
    const current = [...notifications];
    setNotifications([]);
    setUnreadNotifications(0);

    const colabId = localStorage.getItem('colaboradorId');
    const adminType = localStorage.getItem('adminType');
    if (adminType === 'colaborador' && colabId) {
      const receipts = current.filter((n: any) => !n.is_admin_table).map(n => ({ notificacao_id: n.id.split('_')[1] || n.id, colaborador_id: colabId, lida: true, ocultada: true, atualizado_em: new Date().toISOString() }));
      if (receipts.length) await supabase.from('notificacao_leituras_colaborador').upsert(receipts);
      return;
    }
    const adminIds = current.filter((n: any) => n.is_admin_table).map(n => n.id.split('_')[1] || n.id);
    const generalIds = current.filter((n: any) => !n.is_admin_table).map(n => n.id.split('_')[1] || n.id);
    if (adminIds.length) await supabase.from('admin_notificacoes').delete().in('id', adminIds);
    if (generalIds.length) await supabase.from('notificacoes').delete().in('id', generalIds);
  };

  const combinedPendencies = React.useMemo(() => {
    // Retorna apenas as pendências reais do banco de dados (evita contagem dupla com notificações)
    return pendencies;
  }, [pendencies]);

  return (
    <AdminNotificationContext.Provider value={{
      pendencies: combinedPendencies,
      notifications,
      unreadNotifications,
      markAsRead,
      markAllAsRead,
      deleteAllNotifications,
      refreshCounts: fetchPendencies
    }}>
      {children}
    </AdminNotificationContext.Provider>
  );
}

export function useAdminNotifications() {
  const context = useContext(AdminNotificationContext);
  if (context === undefined) {
    throw new Error('useAdminNotifications must be used within an AdminNotificationProvider');
  }
  return context;
}
