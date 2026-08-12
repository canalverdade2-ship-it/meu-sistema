import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { EcommerceHeader } from './EcommerceHeader';
import { HeroBannerCarousel } from './HeroBannerCarousel';
import StoreItemCard from './StoreItemCard';
import { Loader2, TrendingUp, Zap, Clock, Star, ArrowRight } from 'lucide-react';
import { navigate } from '../../../routing/navigationService';
import { routes } from '../../../routing/routeCatalog';
import { useSEO } from '../../../hooks/useSEO';

interface EcommerceHomeProps {
  clientId?: string;
  onRequireAuth?: () => void;
  onOpenCart?: () => void;
  cartItemCount?: number;
}

export function EcommerceHome({
  clientId,
  onRequireAuth,
  onOpenCart = () => {},
  cartItemCount = 0
}: EcommerceHomeProps) {
  const [loading, setLoading] = useState(true);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [maisVendidos, setMaisVendidos] = useState<any[]>([]);
  const [novidades, setNovidades] = useState<any[]>([]);
  const [ofertas, setOfertas] = useState<any[]>([]);
  const [recomendados, setRecomendados] = useState<any[]>([]);
  const [localCartCount, setLocalCartCount] = useState(cartItemCount);

  useEffect(() => {
    setLocalCartCount(cartItemCount);
  }, [cartItemCount]);

  useSEO({
    title: 'GSA Store - A melhor loja de compras online',
    description: 'Encontre os melhores produtos, assinaturas e serviços na GSA Store com preços imperdíveis.',
    type: 'website'
  });

  useEffect(() => {
    if (clientId && cartItemCount === 0) {
      const fetchCart = async () => {
        try {
          const { data, error } = await supabase
            .from('loja_carrinhos')
            .select('quantidade')
            .eq('cliente_id', clientId);
          
          if (data && !error) {
            const count = data.reduce((acc, curr) => acc + (curr.quantidade || 1), 0);
            setLocalCartCount(count);
          }
        } catch (err) {
          console.error('Erro ao buscar carrinho:', err);
        }
      };
      fetchCart();
    }
  }, [clientId, cartItemCount]);

  useEffect(() => {
    const fetchHomeData = async () => {
      setLoading(true);
      try {
        // Busca produtos básicos para preencher as prateleiras
        const { data, error } = await supabase
          .from('produtos')
          .select('*')
          .eq('status', 'ativo')
          .eq('visivel_na_loja', true)
          .order('created_at', { ascending: false })
          .limit(50);

        if (data && !error) {
          setProdutos(data);
          
          // Simulação de prateleiras (isso deve vir de queries ou views específicas no futuro)
          setNovidades(data.slice(0, 8)); // Últimos adicionados
          
          // Mais vendidos (simulado misturando)
          const shuffled = [...data].sort(() => 0.5 - Math.random());
          setMaisVendidos(shuffled.slice(0, 8));
          
          // Ofertas (produtos com desconto configurado)
          const comDesconto = data.filter(p => p.valor_promocional && p.valor_promocional < p.valor);
          // Se não tiver suficientes, simula alguns
          setOfertas(comDesconto.length >= 4 ? comDesconto.slice(0, 8) : data.slice(5, 13));

          // Recomendados para Você (simulado baseado no histórico, aqui embaralhamos diferente)
          const shuffledRec = [...data].sort(() => 0.5 - Math.random());
          setRecomendados(shuffledRec.slice(0, 4));
        }
      } catch (error) {
        console.error('Erro ao carregar dados da home:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHomeData();
  }, []);

  const ShelfHeader = ({ title, icon: Icon, subtitle, actionText, onAction }: any) => (
    <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-neutral-100 pb-4">
      <div>
        <div className="flex items-center gap-2 text-[#17345f]">
          {Icon && <Icon className="h-6 w-6" strokeWidth={2.5} />}
          <h2 className="text-2xl font-black tracking-tight">{title}</h2>
        </div>
        {subtitle && <p className="mt-1 text-sm font-medium text-neutral-500">{subtitle}</p>}
      </div>
      {actionText && (
        <button 
          onClick={onAction}
          className="group flex items-center gap-1 text-sm font-bold text-[#d8bd73] transition-colors hover:text-[#c4a961]"
        >
          {actionText}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </button>
      )}
    </div>
  );

  const ProductGrid = ({ items }: { items: any[] }) => (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:gap-5">
      {items.map((item) => (
        <StoreItemCard
          key={item.id}
          item={item}
          tipo="produto"
          onAdd={() => navigate(routes.marketplace.store.product(item.id) + '?modal=quantidade')}
          onClick={() => navigate(routes.marketplace.store.product(item.id))}
        />
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <EcommerceHeader 
        clientId={clientId}
        cartItemCount={localCartCount}
        onOpenCart={onOpenCart}
        onRequireAuth={onRequireAuth}
      />
      
      <main className="pb-24">
        {/* Banner Hero */}
        <section className="mb-12">
          <HeroBannerCarousel />
        </section>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#d8bd73]" />
          </div>
        ) : (
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-16">
            
            {/* Benefícios Rápidos */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 -mt-8 relative z-30">
              {[
                { title: 'Pagamento Seguro', desc: 'Ambiente 100% protegido', icon: Star },
                { title: 'Pontos GSA', desc: 'Ganhe em todas as compras', icon: TrendingUp },
                { title: 'Entrega Expressa', desc: 'Receba mais rápido', icon: Zap },
                { title: 'Suporte 24h', desc: 'Atendimento especializado', icon: Clock },
              ].map((benefit, i) => (
                <div key={i} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm border border-neutral-100">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#17345f]/10 text-[#17345f]">
                    <benefit.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-neutral-900 sm:text-sm">{benefit.title}</h3>
                    <p className="text-[10px] text-neutral-500 sm:text-xs">{benefit.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Prateleira Inteligente: Recomendados para Você */}
            {recomendados.length > 0 && (
              <section className="relative rounded-3xl bg-gradient-to-br from-indigo-50 to-white p-6 shadow-sm ring-1 ring-indigo-100 sm:p-8">
                <div className="absolute right-0 top-0 h-32 w-32 -translate-y-8 translate-x-8 rounded-full bg-indigo-100/50 blur-3xl" />
                <ShelfHeader 
                  title="Recomendados para Você" 
                  icon={Star} 
                  subtitle="Baseado no seu histórico e preferências de compra" 
                  actionText="Ver recomendados"
                  onAction={() => navigate(routes.marketplace.store.products() + '?filtro=recomendados')}
                />
                <div className="relative z-10">
                  <ProductGrid items={recomendados} />
                </div>
              </section>
            )}

            {/* Prateleira 1: Ofertas Relâmpago */}
            <section>
              <div className="flex items-center justify-between">
                <ShelfHeader 
                  title="Ofertas Relâmpago" 
                  icon={Zap} 
                  subtitle="Preços imperdíveis por tempo limitado" 
                  actionText="Ver todas as ofertas"
                  onAction={() => navigate(routes.marketplace.store.products() + '?filtro=ofertas')}
                />
                <div className="hidden sm:flex items-center gap-2 mb-8 bg-rose-50 text-rose-600 px-4 py-2 rounded-xl border border-rose-100">
                  <Clock className="w-4 h-4 animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-wider">Termina em:</span>
                  <div className="flex gap-1 text-sm font-black font-mono">
                    <span className="bg-white px-1.5 py-0.5 rounded border border-rose-200">03</span>:
                    <span className="bg-white px-1.5 py-0.5 rounded border border-rose-200">45</span>:
                    <span className="bg-white px-1.5 py-0.5 rounded border border-rose-200">12</span>
                  </div>
                </div>
              </div>
              <ProductGrid items={ofertas} />
            </section>

            {/* Banner Promocional Intermediário */}
            <section className="relative overflow-hidden rounded-3xl bg-[#17345f]">
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent z-10" />
              <img 
                src="https://images.unsplash.com/photo-1556740738-b6a63e27c4df?auto=format&fit=crop&w=1200&q=80" 
                alt="Banner promocional" 
                className="absolute inset-0 h-full w-full object-cover opacity-50"
              />
              <div className="relative z-20 flex flex-col items-start justify-center p-8 sm:p-12 md:w-1/2">
                <span className="mb-2 rounded-full bg-[#d8bd73] px-3 py-1 text-xs font-black uppercase tracking-wider text-white">
                  Programa VIP
                </span>
                <h3 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                  Preços Exclusivos para Membros
                </h3>
                <p className="mt-3 text-white/80 font-medium">
                  Ative seu VIP e economize até 30% adicional em produtos selecionados.
                </p>
                <button 
                  onClick={() => navigate(routes.marketplace.store.vip())}
                  className="mt-6 rounded-xl bg-white px-6 py-3 text-sm font-bold text-[#17345f] transition-all hover:bg-neutral-100 shadow-lg cursor-pointer hover:scale-105 active:scale-95"
                >
                  Conhecer o Programa
                </button>
              </div>
            </section>

            {/* Prateleira 2: Mais Vendidos */}
            <section>
              <ShelfHeader 
                title="Mais Vendidos" 
                icon={TrendingUp} 
                subtitle="Os produtos favoritos da nossa comunidade" 
                actionText="Ver mais vendidos"
                onAction={() => navigate(routes.marketplace.store.products() + '?filtro=mais-vendidos')}
              />
              <ProductGrid items={maisVendidos} />
            </section>

            {/* Categorias Populares */}
            <section>
              <ShelfHeader title="Navegue por Categorias" />
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
                {[
                  { name: 'Eletrônicos', icon: '💻', color: 'bg-blue-50' },
                  { name: 'Casa', icon: '🏠', color: 'bg-orange-50' },
                  { name: 'Moda', icon: '👕', color: 'bg-pink-50' },
                  { name: 'Beleza', icon: '✨', color: 'bg-purple-50' },
                  { name: 'Viagens', icon: '✈️', color: 'bg-cyan-50' },
                  { name: 'Serviços', icon: '🔧', color: 'bg-emerald-50' },
                ].map((cat, i) => (
                  <div 
                    key={i}
                    className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl ${cat.color} p-6 transition-transform hover:-translate-y-1`}
                    onClick={() => navigate(routes.marketplace.store.products())}
                  >
                    <span className="text-4xl">{cat.icon}</span>
                    <span className="text-sm font-bold text-neutral-800">{cat.name}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Prateleira 3: Novidades */}
            <section>
              <ShelfHeader 
                title="Novidades" 
                icon={Star} 
                subtitle="Acabaram de chegar na loja" 
                actionText="Ver lançamentos"
                onAction={() => navigate(routes.marketplace.store.products() + '?filtro=novidades')}
              />
              <ProductGrid items={novidades} />
            </section>

          </div>
        )}
      </main>
    </div>
  );
}

export default EcommerceHome;
