import React, { useState, useEffect } from 'react';
import { Search, ShoppingCart, User, Menu, X, ChevronDown, Bell, LogIn, Diamond, Loader2 } from 'lucide-react';
import { navigate } from '../../../routing/navigationService';
import { routes } from '../../../routing/routeCatalog';
import { useAppLocation } from '../../../routing/useAppLocation';
import { LogoGSA } from '../../ui/LogoGSA';
import { formatCurrency } from '../../../lib/utils';
import { supabase } from '../../../lib/supabase';
import { useClientNotifications } from '../../../hooks/useClientNotifications';
import { VolteEganheModal } from './VolteEganheModal';

interface EcommerceHeaderProps {
  clientId?: string;
  cartItemCount: number;
  onOpenCart: () => void;
  onRequireAuth?: () => void;
  onSearch?: (query: string) => void;
  initialSearchQuery?: string;
  notifications?: any[];
  unreadCount?: number;
  onMarkNotificationAsRead?: (id: string) => void;
}

export function EcommerceHeader({
  clientId,
  cartItemCount,
  onOpenCart,
  onRequireAuth,
  onSearch,
  initialSearchQuery = '',
}: EcommerceHeaderProps) {
  const { notifications, unreadNotifications, markAsRead, markAllAsRead } = useClientNotifications();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const route = useAppLocation();

  const [pointsBalance, setPointsBalance] = useState(0);

  // Volte e Ganhe Logic
  const [showVolteGanhe, setShowVolteGanhe] = useState(false);
  const [volteGanheCoupon, setVolteGanheCoupon] = useState('');
  const [volteGanheNotifId, setVolteGanheNotifId] = useState('');

  useEffect(() => {
    if (notifications && notifications.length > 0) {
      const activeVolteGanhe = notifications.find(n => !n.lida && n.tipo === 'volte_e_ganhe');
      if (activeVolteGanhe && !showVolteGanhe && volteGanheNotifId !== activeVolteGanhe.id) {
        setShowVolteGanhe(true);
        // O cupom pode vir no item_id ou na mensagem (ex: VOLTE10)
        setVolteGanheCoupon(activeVolteGanhe.item_id || 'VOLTE10');
        setVolteGanheNotifId(activeVolteGanhe.id);
      }
    }
  }, [notifications, showVolteGanhe, volteGanheNotifId]);

  const handleApplyVolteGanhe = () => {
    // In a real scenario, applying the coupon could save to cart state.
    // For now, we just mark the notification as read.
    if (volteGanheNotifId) {
      markAsRead(volteGanheNotifId);
    }
    setShowVolteGanhe(false);
  };

  const handleCloseVolteGanhe = () => {
    if (volteGanheNotifId) {
      markAsRead(volteGanheNotifId);
    }
    setShowVolteGanhe(false);
  };

  useEffect(() => {
    if (clientId) {
      const fetchPoints = async () => {
        try {
          const { data, error } = await supabase
            .from('points_balances')
            .select('balance')
            .eq('cliente_id', clientId)
            .maybeSingle();
            
          if (data && !error) {
            setPointsBalance(data.balance || 0);
          } else {
            // Se a view não existir, tenta pela tabela de movimentações
            const { data: movData, error: movError } = await supabase
              .from('pontos_movimentacoes')
              .select('pontos')
              .eq('cliente_id', clientId);
              
            if (movData && !movError) {
              const total = movData.reduce((acc, curr) => acc + (curr.pontos || 0), 0);
              setPointsBalance(total);
            }
          }
        } catch (err) {
          console.error('Erro ao buscar saldo de pontos:', err);
        }
      };
      fetchPoints();
    }
  }, [clientId]);

  // Debounce para busca inteligente
  useEffect(() => {
    const handler = setTimeout(async () => {
      if (searchQuery.length > 2) {
        setIsSearching(true);
        try {
          const { data, error } = await supabase
            .from('produtos')
            .select('id, nome, valor, imagem_url, categoria_id, categorias(nome)')
            .eq('status', 'ativo')
            .eq('visivel_na_loja', true)
            .ilike('nome', `%${searchQuery}%`)
            .limit(5);
            
          if (data && !error) {
            setSuggestions(data);
            setShowSuggestions(true);
          }
        } catch (err) {
          console.error('Erro na busca inteligente:', err);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
      
      if (onSearch) {
        onSearch(searchQuery);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery, onSearch]);

  // Fecha sugestões ao clicar fora (simplificado)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.search-container')) {
        setShowSuggestions(false);
      }
      if (!(e.target as Element).closest('.notifications-container')) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(searchQuery);
    }
  };

  const departments = [
    { label: 'Todos os Departamentos', action: () => navigate(routes.marketplace.store.products()) },
    { label: 'Viagens', action: () => navigate(routes.marketplace.travelPackages.root()) },
    { label: 'Classificados', action: () => navigate(routes.marketplace.classifieds.root()) },
    { label: 'Saúde', action: () => navigate(routes.marketplace.saude.root()) },
    { label: 'Seguros', action: () => navigate(routes.marketplace.seguros.root()) },
  ];

  return (
    <>
      <header className="sticky top-0 z-50 w-full bg-[#17345f] shadow-md">
        {/* Top bar */}
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Mobile menu button & Logo */}
        <div className="flex items-center gap-4 lg:gap-8">
          <button
            type="button"
            className="lg:hidden rounded-md p-2 text-white hover:bg-white/10"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
          
          <div className="flex-shrink-0 cursor-pointer" onClick={() => navigate(routes.marketplace.root())}>
            <LogoGSA size="md" variant="light" />
          </div>
        </div>

        {/* Search Bar (Desktop) */}
        <div className="hidden flex-1 items-center justify-center px-8 lg:flex relative search-container" onClick={(e) => e.stopPropagation()}>
          <form onSubmit={handleSearchSubmit} className="w-full max-w-2xl relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value.length <= 2) setShowSuggestions(false);
              }}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              placeholder="O que você está procurando?"
              className="w-full rounded-full border-0 bg-white py-2.5 pl-4 pr-12 text-sm text-neutral-900 shadow-inner focus:outline-none focus:ring-2 focus:ring-[#d8bd73]"
            />
            <button
              type="submit"
              className="absolute right-0 top-0 flex h-full items-center justify-center rounded-r-full px-4 text-[#17345f] hover:text-[#0c2340]"
            >
              {isSearching ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
            </button>
            
            {/* Dropdown de Sugestões */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 top-full mt-2 w-full overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-black/5 z-50">
                <ul className="max-h-96 overflow-y-auto py-2">
                  {suggestions.map((item) => (
                    <li key={item.id}>
                      <button
                        onClick={() => {
                          setShowSuggestions(false);
                          setSearchQuery('');
                          navigate(routes.marketplace.store.product(item.id));
                        }}
                        className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-neutral-50"
                      >
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                          {item.imagem_url ? (
                            <img src={item.imagem_url} alt={item.nome} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-neutral-400">
                              <Search className="h-4 w-4" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-bold text-neutral-900">{item.nome}</p>
                          <p className="truncate text-xs text-neutral-500">
                            {item.categorias?.nome || 'Produto'}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-black text-[#17345f]">{formatCurrency(item.valor)}</p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-neutral-100 bg-neutral-50 px-4 py-3">
                  <button 
                    onClick={handleSearchSubmit}
                    className="w-full text-center text-xs font-bold text-[#17345f] hover:text-[#0c2340]"
                  >
                    Ver todos os resultados
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* User Actions */}
        <div className="flex items-center gap-3 sm:gap-6">
          {clientId ? (
            <>
              {/* Pontos */}
              <div 
                className="hidden sm:flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-bold text-white cursor-pointer hover:bg-white/20 transition-colors"
                onClick={() => navigate(routes.client.loyalty.pontos())}
                title="Saldo de Pontos GSA"
              >
                <Diamond className="h-4 w-4 text-[#d8bd73] fill-[#d8bd73]" />
                <span>{pointsBalance.toLocaleString('pt-BR')} pts</span>
              </div>
              
              {/* Notificações */}
              <div className="relative hidden sm:block notifications-container">
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="text-white hover:text-[#d8bd73] transition-colors relative"
                >
                  <Bell className="h-5 w-5" />
                  {unreadNotifications > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border border-[#17345f]">
                      {unreadNotifications > 99 ? '99+' : unreadNotifications}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute right-0 top-full mt-3 w-80 overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-black/5 z-50">
                    <div className="px-4 py-3 border-b border-neutral-100 flex justify-between items-center bg-neutral-50">
                      <h3 className="text-sm font-bold text-neutral-900">Notificações</h3>
                      <button 
                        onClick={() => markAllAsRead()}
                        className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 uppercase tracking-wider"
                      >
                        Marcar lidas
                      </button>
                    </div>
                    <ul className="max-h-80 overflow-y-auto">
                      {notifications.length > 0 ? notifications.map((notif) => (
                        <li 
                          key={notif.id} 
                          onClick={() => markAsRead(notif.id)}
                          className={`p-4 border-b border-neutral-50 transition-colors hover:bg-neutral-50 cursor-pointer ${!notif.lida ? 'bg-indigo-50/30' : ''}`}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <p className="text-sm font-bold text-neutral-900">{notif.titulo}</p>
                            <span className="text-[10px] text-neutral-400 font-semibold">
                              {notif.data_criacao ? new Date(notif.data_criacao).toLocaleDateString() : 'Agora'}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-600 leading-relaxed">{notif.mensagem}</p>
                        </li>
                      )) : (
                        <li className="p-6 text-center text-sm text-neutral-500">Nenhuma notificação no momento.</li>
                      )}
                    </ul>
                    <div className="p-2 border-t border-neutral-100 bg-neutral-50">
                      <button className="w-full py-2 text-center text-xs font-bold text-neutral-600 hover:text-neutral-900 transition-colors">
                        Ver todas as notificações
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Minha Conta */}
              <div 
                className="flex items-center gap-2 cursor-pointer text-white hover:text-[#d8bd73] transition-colors"
                onClick={() => navigate(routes.client.dashboard())}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                  <User className="h-4 w-4" />
                </div>
                <div className="hidden lg:block text-xs">
                  <span className="block font-medium text-white/70">Olá, Cliente</span>
                  <span className="block font-bold leading-none">Minha Conta</span>
                </div>
              </div>
            </>
          ) : (
            <button
              onClick={onRequireAuth || (() => navigate(routes.login.root()))}
              className="flex items-center gap-2 text-sm font-bold text-white hover:text-[#d8bd73] transition-colors"
            >
              <LogIn className="h-5 w-5" />
              <span className="hidden sm:inline">Entrar / Cadastrar</span>
            </button>
          )}

          {/* Carrinho */}
          <button 
            className="flex items-center gap-2 text-white hover:text-[#d8bd73] transition-colors relative"
            onClick={onOpenCart}
          >
            <div className="relative flex h-8 w-8 items-center justify-center">
              <ShoppingCart className="h-5 w-5" />
              {cartItemCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                  {cartItemCount > 99 ? '99+' : cartItemCount}
                </span>
              )}
            </div>
          </button>
        </div>
      </div>

      {/* Search Bar (Mobile) */}
      <div className="bg-[#0c2340] px-4 py-3 lg:hidden">
        <form onSubmit={handleSearchSubmit} className="relative w-full">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar produtos..."
            className="w-full rounded-md border-0 bg-white py-2 pl-3 pr-10 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#d8bd73]"
          />
          <button
            type="submit"
            className="absolute right-0 top-0 flex h-full items-center justify-center px-3 text-neutral-500"
          >
            <Search className="h-4 w-4" />
          </button>
        </form>
      </div>

      {/* Departments Menu Bar */}
      <div className="hidden bg-[#0c2340] lg:block">
        <div className="mx-auto flex max-w-7xl items-center px-4 sm:px-6 lg:px-8">
          <ul className="flex flex-1 items-center gap-6">
            {departments.map((dept, idx) => (
              <li key={idx}>
                <button
                  onClick={dept.action}
                  className={`flex items-center gap-1 py-3 text-[13px] font-bold uppercase tracking-wider text-white transition-colors hover:text-[#d8bd73] ${idx === 0 ? 'text-[#d8bd73]' : ''}`}
                >
                  {idx === 0 && <Menu className="h-4 w-4" />}
                  {dept.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="absolute left-0 top-[116px] z-50 w-full bg-white shadow-xl lg:hidden border-t border-neutral-200">
          <ul className="flex flex-col py-2">
            {departments.map((dept, idx) => (
              <li key={idx}>
                <button
                  onClick={() => {
                    dept.action();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full px-5 py-3 text-left text-sm font-bold text-neutral-700 hover:bg-neutral-50 hover:text-[#17345f]"
                >
                  {dept.label}
                </button>
              </li>
            ))}
            {clientId && (
              <>
                <li className="border-t border-neutral-100 my-1"></li>
                <li>
                  <div className="flex items-center gap-2 px-5 py-3 text-sm font-bold text-neutral-700">
                    <Diamond className="h-4 w-4 text-[#d8bd73] fill-[#d8bd73]" />
                    Saldo: {pointsBalance.toLocaleString('pt-BR')} pontos
                  </div>
                </li>
              </>
            )}
          </ul>
        </div>
      )}
      </header>

      <VolteEganheModal 
        isOpen={showVolteGanhe} 
        onClose={handleCloseVolteGanhe} 
        couponCode={volteGanheCoupon}
        onApplyCoupon={handleApplyVolteGanhe}
      />
    </>
  );
}

export default EcommerceHeader;
