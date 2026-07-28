import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Star, ShieldCheck, Zap, CreditCard, ChevronRight, History, Award, Copy, Check, Lock, Sparkles, Trophy, Gem, Medal, AlertTriangle, X } from 'lucide-react';
import { Cliente } from '../../types';
import { toast } from 'react-hot-toast';
import { copyToClipboard, generateUUID } from '../../lib/utils';
import { VIP_LEVELS, VIPLevel } from '../../constants';
import { supabase } from '../../lib/supabase';
import { Modal } from '../ui/Modal';
import { useAutoFitTabs } from '../../hooks/useAutoFitTabs';
import { callClientRpc } from '../../lib/clientRpc';

const TABS = ['Geral', 'Benefícios', 'Níveis', 'Histórico'];
const TAB_LABELS: Record<string, string> = {
  Geral: 'Geral',
  Benefícios: 'Benefícios',
  Níveis: 'Níveis',
  Histórico: 'Histórico'
};

export function ClientAreaVIP({ 
  cliente,
  initialTab,
  initialItemId 
}: { 
  cliente: Cliente,
  initialTab?: string,
  initialItemId?: string
}) {
  const { containerRef: vipTabsRef, setButtonRef: setVipTabButtonRef } = useAutoFitTabs(14, 9);
  const [activeTab, setActiveTab] = useState(initialTab || TABS[0]);
  const [copied, setCopied] = useState(false);
  const [selectedLevelToBuy, setSelectedLevelToBuy] = useState<VIPLevel | null>(null);
  const [isBuying, setIsBuying] = useState(false);
  const [levels, setLevels] = useState<VIPLevel[]>(VIP_LEVELS);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const vipPurchaseRequestId = useRef(generateUUID());

  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  const hasAutoOpened = useRef<string | null>(null);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (initialItemId && hasAutoOpened.current !== initialItemId) {
      // If it's a level id, switch to 'Níveis' and scroll there
      if (initialItemId.startsWith('level-')) {
        hasAutoOpened.current = initialItemId;
        setActiveTab('Níveis');
        setTimeout(() => {
          const element = document.getElementById(initialItemId);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHighlightedItemId(initialItemId);
            setTimeout(() => setHighlightedItemId(null), 3000);
          }
        }, 400);
      } else if (initialItemId === 'vip-card') {
        hasAutoOpened.current = initialItemId;
        setActiveTab('Geral');
        setTimeout(() => {
          const element = document.getElementById('vip-card');
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHighlightedItemId('vip-card');
            setTimeout(() => setHighlightedItemId(null), 3000);
          }
        }, 400);
      }
    }
  }, [initialItemId, levels.length]);

  useEffect(() => {
    fetchLevels();

    const channel = supabase
      .channel('client-vip-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_levels' }, () => {
        fetchLevels();
      })
      .subscribe();

  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  const hasAutoOpened = useRef<string | null>(null);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (initialItemId && hasAutoOpened.current !== initialItemId) {
      // If it's a level id, switch to 'Níveis' and scroll there
      if (initialItemId.startsWith('level-')) {
        hasAutoOpened.current = initialItemId;
        setActiveTab('Níveis');
        setTimeout(() => {
          const element = document.getElementById(initialItemId);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHighlightedItemId(initialItemId);
            setTimeout(() => setHighlightedItemId(null), 3000);
          }
        }, 400);
      } else if (initialItemId === 'vip-card') {
        hasAutoOpened.current = initialItemId;
        setActiveTab('Geral');
        setTimeout(() => {
          const element = document.getElementById('vip-card');
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHighlightedItemId('vip-card');
            setTimeout(() => setHighlightedItemId(null), 3000);
          }
        }, 400);
      }
    }
  }, [initialItemId, levels.length]);

  useEffect(() => {
    fetchLevels();

    const channel = supabase
      .channel('client-vip-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_levels' }, () => {
        fetchLevels();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    
    const fetchHistory = async () => {
      if (!cliente.id) return;
      if (isMounted) setHistoryLoading(true);
      try {
        console.log('Fetching level history (simple query) for client:', cliente.id);
        const { data: historyData, error } = await supabase
          .from('level_history')
          .select('*, nivel_anterior:client_levels!nivel_anterior_id(nome_nivel), nivel_novo:client_levels!nivel_novo_id(nome_nivel)')
          .eq('cliente_id', cliente.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Supabase error fetching history:', error);
          throw error;
        }
        
        // Map names locally using the points definitions and database IDs
        const enrichedHistory = (historyData || []).map(item => {
          // Try finding by dbId first, then fallback to name if possible
          const prevLevel = levels.find(l => l.dbId === item.nivel_anterior_id);
          const nextLevel = levels.find(l => l.dbId === item.nivel_novo_id);
          
          return {
            ...item,
            nivel_anterior_nome: prevLevel?.name || 'Início',
            nivel_novo_nome: nextLevel?.name || 'Nível VIP'
          };
        });

        console.log('Enriched history:', enrichedHistory);
        if (isMounted) setHistory(enrichedHistory);
      } catch (error) {
        console.error('Error fetching level history:', error);
        toast.error('Não foi possível carregar o histórico de níveis.');
      } finally {
        if (isMounted) setHistoryLoading(false);
      }
    };

    if (activeTab === 'Histórico' && !loading) {
      fetchHistory();
    }
    
    return () => { isMounted = false; };
  }, [activeTab, loading, cliente.id, levels]);

  const fetchLevels = async () => {
    try {
      const { data, error } = await supabase
        .from('client_levels')
        .select('*')
        .order('pontos_minimos', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        const mappedLevels: VIPLevel[] = data.map(dbLevel => ({
          id: dbLevel.nome_nivel.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
          name: dbLevel.nome_nivel,
          minPoints: dbLevel.pontos_minimos,
          maxPoints: dbLevel.pontos_maximos,
          multiplier: Number(dbLevel.pontos_por_real),
          color: dbLevel.cor || '#f5f5f5',
          textColor: dbLevel.cor_texto || '#1a1a1a',
          visualStyle: (dbLevel.visual_style as any) || 'clean',
          feePercentage: Number(dbLevel.taxa_saque_transferencia),
          price: Number(dbLevel.preco),
          benefits: Array.isArray(dbLevel.benefits) ? dbLevel.benefits : [],
          exclusiveBenefits: Array.isArray(dbLevel.exclusive_benefits) ? dbLevel.exclusive_benefits : [],
          dbId: dbLevel.id
        }));
        setLevels(mappedLevels);
      }
    } catch (error) {
      console.error('Error fetching levels:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(dateString));
  };

  const handleCopyCode = async () => {
    if (cliente.codigo_cliente) {
      const success = await copyToClipboard(cliente.codigo_cliente);
      if (success) {
        setCopied(true);
        toast.success('Código VIP copiado!');
        setTimeout(() => setCopied(false), 2000);
      } else {
        toast.error('Erro ao copiar código.');
      }
    }
  };

  const currentPoints = cliente.pontos_totais || 0;
  
  // Resolve current level using dbId UUID matching
  // Priority: manual level (nivel_manual_id) > auto level (nivel_id) > points-based fallback
  let currentLevel = null;
  if (levels.length > 0) {
    const manualId = cliente.nivel_manual_id;
    const autoId = cliente.nivel_id;
    
    if (manualId) {
      currentLevel = (levels as any[]).find((l: any) => l.dbId === manualId)
        || ((cliente as any).manual_level ? levels.find(l => l.name.toLowerCase() === (cliente as any).manual_level?.nome_nivel?.toLowerCase()) : null);
    }
    if (!currentLevel && autoId) {
      currentLevel = (levels as any[]).find((l: any) => l.dbId === autoId)
        || ((cliente as any).auto_level ? levels.find(l => l.name.toLowerCase() === (cliente as any).auto_level?.nome_nivel?.toLowerCase()) : null);
    }
    if (!currentLevel) {
      currentLevel = levels.find(l => currentPoints >= l.minPoints && (l.maxPoints === null || currentPoints <= l.maxPoints)) || levels[0];
    }
  }
  currentLevel = currentLevel || levels[0];
  
  const currentLevelIndex = levels.indexOf(currentLevel);
  const nextLevel = levels[currentLevelIndex + 1];
  const progress = nextLevel ? Math.min(100, (currentPoints / nextLevel.minPoints) * 100) : 100;

  // Cumulative benefits
  const allActiveBenefits = levels.slice(0, currentLevelIndex + 1).flatMap(l => l.exclusiveBenefits);

  const getLevelStyles = (level: VIPLevel) => {
    switch (level.visualStyle) {
      case 'copper':
        return {
          bg: 'bg-gradient-to-br from-[#804a00] via-[#cd7f32] to-[#804a00]',
          text: 'text-white',
          accent: 'bg-white/20',
          glow: 'bg-orange-500/20',
          border: 'ring-orange-400/30',
          icon: Trophy
        };
      case 'silver':
        return {
          bg: 'bg-gradient-to-br from-[#a0a0a0] via-[#e0e0e0] to-[#a0a0a0]',
          text: 'text-neutral-900',
          accent: 'bg-black/10',
          glow: 'bg-white/40',
          border: 'ring-white/50',
          icon: ShieldCheck
        };
      case 'gold-black':
        return {
          bg: 'bg-gradient-to-br from-[#000000] via-[#1a1a1a] to-[#000000]',
          text: 'text-[#ffd700]',
          accent: 'bg-[#ffd700]/20',
          glow: 'bg-[#ffd700]/10',
          border: 'ring-[#ffd700]/30',
          icon: Crown
        };
      case 'diamond':
        return {
          bg: 'bg-gradient-to-br from-[#004e92] via-[#000428] to-[#004e92]',
          text: 'text-[#b9f2ff]',
          accent: 'bg-[#b9f2ff]/20',
          glow: 'bg-[#b9f2ff]/30',
          border: 'ring-[#b9f2ff]/40',
          icon: Gem
        };
      case 'black-luxury':
        return {
          bg: 'bg-gradient-to-br from-[#000000] via-[#111111] to-[#000000]',
          text: 'text-white',
          accent: 'bg-white/10',
          glow: 'bg-white/5',
          border: 'ring-white/20',
          icon: Sparkles
        };
      default: // clean
        return {
          bg: 'bg-white',
          text: 'text-neutral-900',
          accent: 'bg-neutral-100',
          glow: 'bg-neutral-50',
          border: 'ring-neutral-300',
          icon: Star
        };
    }
  };

  const styles = getLevelStyles(currentLevel);
  const LevelIcon = styles.icon;

  const pointsValueInReais = (cliente.saldo_pontos || 0) * 0.01;

  const handleBuyLevel = async () => {
    if (!selectedLevelToBuy) return;
    if (!selectedLevelToBuy.dbId) {
      toast.error('Nível VIP indisponível para compra.');
      return;
    }
    setIsBuying(true);
    try {
      const data = await callClientRpc<any>('gsa_client_subscribe_vip', {
        p_request_id: vipPurchaseRequestId.current,
        p_nivel_id: selectedLevelToBuy.dbId,
      });
      vipPurchaseRequestId.current = generateUUID();
      toast.success(data?.pago_integralmente_com_pontos
        ? 'Nível VIP confirmado com seus pontos!'
        : 'Fatura gerada com sucesso! Aguarde o link de pagamento.');
      setSelectedLevelToBuy(null);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao processar assinatura VIP');
    } finally {
      setIsBuying(false);
    }
  };

        {activeTab === 'Histórico' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-white p-8 rounded-[3rem] shadow-sm ring-1 ring-black/5">
              <div className="flex items-center gap-3 mb-8">
                <div className="h-10 w-10 rounded-xl bg-neutral-50 flex items-center justify-center text-neutral-400">
                  <History size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-neutral-900">Histórico de Níveis</h3>
                  <p className="text-xs text-neutral-500 font-medium">Acompanhe sua evolução e conquistas no Programa VIP.</p>
                </div>
              </div>

              {historyLoading ? (
                <div className="py-12 text-center">
                  <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-xs font-black text-neutral-400 uppercase tracking-widest">Buscando registros...</p>
                </div>
              ) : history.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed border-neutral-100 rounded-[2rem]">
                  <div className="h-16 w-16 rounded-full bg-neutral-50 flex items-center justify-center text-neutral-200 mx-auto mb-4">
                    <Award size={32} />
                  </div>
                  <h4 className="text-xl font-bold text-neutral-300">Nenhum registro ainda</h4>
                  <p className="text-sm text-neutral-400 max-w-xs mx-auto mt-2">Suas mudanças de nível aparecerão aqui assim que você progredir no sistema.</p>
                </div>
              ) : (
                <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:h-full before:w-0.5 before:bg-neutral-100 pb-4">
                  {history.map((item, idx) => (
                    <div key={item.id} className="relative flex items-center gap-6 pl-12 group">
                      {/* Timeline Dot */}
                      <div className="absolute left-0 ml-[14px] h-3 w-3 rounded-full bg-white ring-4 ring-neutral-100 group-hover:ring-indigo-100 group-hover:bg-indigo-600 transition-all duration-300"></div>
                      
                      <div className="flex-1 bg-neutral-50 p-6 rounded-2xl border border-neutral-100 group-hover:border-indigo-100 group-hover:bg-white transition-all duration-300 group-hover:shadow-xl group-hover:shadow-indigo-500/5">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-1">
                              {formatDate(item.created_at)}
                            </span>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-bold text-neutral-400 line-through decoration-neutral-300">
                                {item.nivel_anterior?.nome_nivel || 'Nível Base'}
                              </span>
                              <ChevronRight size={16} className="text-neutral-300" />
                              <span className="text-lg font-black text-indigo-600">
                                {item.nivel_novo?.nome_nivel || 'Nível Atual'}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-neutral-100 text-neutral-500 group-hover:text-indigo-600 group-hover:border-indigo-100 transition-colors shadow-sm">
                            <Zap size={14} />
                            <span className="text-[10px] font-black uppercase tracking-widest">{item.observacao || 'Mudança de Patamar'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
      <Modal 
        isOpen={!!selectedLevelToBuy} 
        onClose={() => setSelectedLevelToBuy(null)} 
        title={`Comprar Upgrade ${selectedLevelToBuy?.name || ''}`}
        size="full"
      >
        {selectedLevelToBuy && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 bg-neutral-50 p-4 rounded-2xl border border-neutral-100">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${getLevelStyles(selectedLevelToBuy).bg}`}>
                <Crown className="text-white" size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-neutral-900">Desbloqueie benefícios exclusivos instantaneamente</p>
                <p className="text-xs text-neutral-500">Aproveite agora mesmo sua nova experiência VIP.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-neutral-900 uppercase tracking-widest opacity-50">Seus Benefícios Atuais</h4>
                <ul className="space-y-2">
                  {currentLevel.exclusiveBenefits.slice(0, 4).map((benefit, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-neutral-600">
                      <Check size={16} className="text-neutral-400 shrink-0 mt-0.5" />
                      <span>{benefit}</span>
                    </li>
                  ))}
                  {currentLevel.exclusiveBenefits.length > 4 && (
                    <li className="text-xs text-neutral-400 italic">E mais {currentLevel.exclusiveBenefits.length - 4} benefícios...</li>
                  )}
                </ul>
              </div>
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-indigo-600 uppercase tracking-widest">Novos Benefícios</h4>
                <ul className="space-y-2">
                  {selectedLevelToBuy.exclusiveBenefits.slice(0, 4).map((benefit, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm font-medium text-neutral-900">
                      <Sparkles size={16} className="text-indigo-500 shrink-0 mt-0.5" />
                      <span>{benefit}</span>
                    </li>
                  ))}
                  {selectedLevelToBuy.exclusiveBenefits.length > 4 && (
                    <li className="text-xs text-indigo-400 italic">E mais {selectedLevelToBuy.exclusiveBenefits.length - 4} benefícios...</li>
                  )}
                </ul>
              </div>
            </div>

            <div className="bg-neutral-50 p-6 rounded-2xl space-y-4">
              <h4 className="text-sm font-bold text-neutral-900 uppercase tracking-widest opacity-50 mb-4">Resumo da Compra</h4>
              
              <div className="flex justify-between items-center text-sm">
                <span className="text-neutral-600">Valor do Nível {selectedLevelToBuy.name}</span>
                <span className="font-bold text-neutral-900">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedLevelToBuy.price)}
                </span>
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className="text-neutral-600 flex items-center gap-2">
                  <Star size={14} className="text-amber-500" />
                  Pontos disponíveis ({cliente.saldo_pontos || 0})
                </span>
                <span className="font-bold text-emerald-500">
                  - {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.min(pointsValueInReais, selectedLevelToBuy.price))}
                </span>
              </div>

              <div className="pt-4 border-t border-black/10 flex justify-between items-center">
                <span className="font-black text-neutral-900">Valor a Pagar</span>
                <span className="text-2xl font-black text-indigo-600">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.max(0, selectedLevelToBuy.price - pointsValueInReais))}
                </span>
              </div>
              
              <div className="bg-amber-50 text-amber-800 p-3 rounded-xl text-xs flex items-start gap-2 mt-4">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <p>O valor restante não poderá ser pago utilizando vouchers, saldo da carteira ou mais pontos. Uma fatura será gerada para pagamento via PIX.</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-black/5">
              <button
                onClick={() => setSelectedLevelToBuy(null)}
                className="px-6 py-3 rounded-xl font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 transition-colors"
                disabled={isBuying}
              >
                Cancelar
              </button>
              <button
                onClick={handleBuyLevel}
                disabled={isBuying}
                className="px-8 py-3 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isBuying ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Gerando Fatura...
                  </>
                ) : (
                  'Confirmar Compra'
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </motion.div>
  );
}
